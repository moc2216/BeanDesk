use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Child, ChildStderr, ChildStdout, Command, Stdio};
use std::thread;
#[cfg(unix)]
use std::time::{Duration, Instant};
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(windows)]
use crate::process::windows;

#[derive(Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostSnapshot {
    pub running: bool,
    pub pid: Option<u32>,
    pub started_ms: Option<u64>,
}

/// Owns the process tree this window started, via a Unix parent-watch pipe or a
/// Windows kill-on-close job. External Fava instances never enter this state.
#[derive(Default)]
pub struct Supervisor {
    child: Option<Child>,
    started_at: Option<SystemTime>,
    #[cfg(unix)]
    parent_hold: Option<std::os::fd::OwnedFd>,
    #[cfg(windows)]
    job: Option<std::os::windows::io::OwnedHandle>,
}

impl Drop for Supervisor {
    fn drop(&mut self) {
        self.stop();
    }
}

impl Supervisor {
    /// Ownership of a live child this window started. Not “something answers
    /// on the saved origin.”
    pub fn snapshot(&mut self) -> HostSnapshot {
        self.reap();
        match self.child.as_ref() {
            Some(child) => HostSnapshot {
                running: true,
                pid: Some(child.id()),
                started_ms: started_ms(self.started_at),
            },
            None => HostSnapshot::default(),
        }
    }

    /// Start `command` in `directory` when this supervisor is not already
    /// watching a live process. A second call does not start another one.
    pub fn start(&mut self, directory: &Path, command: &str) -> Result<(), String> {
        self.reap();
        if self.child.is_some() {
            return Ok(());
        }

        let command = command.trim();
        if command.is_empty() || command.len() > 4_000 || command.contains('\0') {
            return Err("empty-command".to_string());
        }
        if !directory.is_absolute() || !directory.is_dir() {
            return Err("directory".to_string());
        }

        let mut shell = grouped_shell(directory);
        #[cfg(unix)]
        let watch = install_parent_watch(&mut shell, command)?;
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;

            // /S strips the outer quotes. raw_arg preserves any quotes already
            // present in the saved command (e.g. a path containing spaces).
            shell
                .args(["/D", "/S", "/C"])
                .raw_arg(format!("\"{command}\""));
        }
        #[cfg(unix)]
        let child = shell.spawn().map_err(|error| format!("spawn: {error}"))?;
        #[cfg(windows)]
        let child = self.spawn_in_job(&mut shell)?;
        #[cfg(unix)]
        {
            drop(watch.child_read);
            self.parent_hold = Some(watch.parent_hold);
        }
        self.child = Some(child);
        self.started_at = Some(SystemTime::now());
        Ok(())
    }

    /// Start a binary directly so the tracked child is the engine itself.
    #[cfg_attr(not(windows), allow(dead_code))]
    pub fn start_program(
        &mut self,
        directory: &Path,
        program: &Path,
        args: &[String],
    ) -> Result<(), String> {
        self.reap();
        if self.child.is_some() {
            return Ok(());
        }
        if !directory.is_absolute() || !directory.is_dir() {
            return Err("directory".to_string());
        }

        let mut cmd = Command::new(program);
        cmd.args(args)
            .current_dir(directory)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            cmd.process_group(0);
        }
        #[cfg(unix)]
        let mut child = cmd.spawn().map_err(|error| format!("spawn: {error}"))?;
        #[cfg(windows)]
        let mut child = self.spawn_in_job(&mut cmd)?;
        forward_stdio(child.stdout.take(), child.stderr.take());
        self.child = Some(child);
        self.started_at = Some(SystemTime::now());
        Ok(())
    }

    #[cfg(windows)]
    fn spawn_in_job(&mut self, command: &mut Command) -> Result<Child, String> {
        let (child, job) =
            windows::spawn_in_job(command).map_err(|error| format!("spawn: {error}"))?;
        self.job = Some(job);
        Ok(child)
    }

    #[cfg(windows)]
    pub fn stop(&mut self) {
        self.job.take();
        if let Some(mut child) = self.child.take() {
            let _ = child.wait();
        }
        self.started_at = None;
    }

    #[cfg(unix)]
    pub fn stop(&mut self) {
        self.parent_hold.take();
        self.started_at = None;
        let Some(mut child) = self.child.take() else {
            return;
        };
        let pid = child.id();
        signal_group(pid, false);
        let started = Instant::now();
        loop {
            match child.try_wait() {
                Ok(Some(_)) => return,
                Ok(None) if started.elapsed() < Duration::from_secs(3) => {
                    thread::sleep(Duration::from_millis(50));
                }
                Ok(None) => {
                    signal_group(pid, true);
                    let _ = child.wait();
                    return;
                }
                Err(_) => return,
            }
        }
    }

    fn reap(&mut self) {
        let finished = match self.child.as_mut() {
            Some(child) => match child.try_wait() {
                Ok(Some(_)) | Err(_) => true,
                Ok(None) => false,
            },
            None => false,
        };
        if finished {
            self.child = None;
            self.started_at = None;
            #[cfg(windows)]
            {
                self.job.take();
            }
            #[cfg(unix)]
            {
                self.parent_hold.take();
            }
        }
    }
}

fn started_ms(started_at: Option<SystemTime>) -> Option<u64> {
    started_at
        .and_then(|started| started.duration_since(UNIX_EPOCH).ok())
        .map(|elapsed| elapsed.as_millis() as u64)
}

/// The read end stays open until after `spawn`, so the child inherits it.
#[cfg(unix)]
struct ParentWatch {
    child_read: std::os::fd::OwnedFd,
    parent_hold: std::os::fd::OwnedFd,
}

/// Run the saved command, and end its process group when the desktop process
/// closes the pipe. The command itself is still executed by a shell.
#[cfg(unix)]
fn install_parent_watch(command: &mut Command, user_command: &str) -> Result<ParentWatch, String> {
    use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
    use std::os::unix::process::CommandExt;

    const WATCH: &str = "leader=$$; ( while IFS= read -r _ <&3; do :; done; kill -TERM -$leader 2>/dev/null || true ) >/dev/null 2>&1 & exec /bin/sh -c \"$1\"";

    let mut ends = [0; 2];
    if unsafe { libc::pipe(ends.as_mut_ptr()) } != 0 {
        return Err(format!("pipe: {}", std::io::Error::last_os_error()));
    }
    let read = unsafe { OwnedFd::from_raw_fd(ends[0]) };
    let write = unsafe { OwnedFd::from_raw_fd(ends[1]) };
    let read_fd = read.as_raw_fd();
    let write_fd = write.as_raw_fd();
    unsafe {
        command.pre_exec(move || {
            if read_fd != 3 && libc::dup2(read_fd, 3) < 0 {
                return Err(std::io::Error::last_os_error());
            }
            if read_fd != 3 {
                libc::close(read_fd);
            }
            let _ = libc::fcntl(3, libc::F_SETFD, 0);
            if write_fd != 3 {
                libc::close(write_fd);
            }
            Ok(())
        });
    }
    command
        .arg("-c")
        .arg(WATCH)
        .arg("beandesk")
        .arg(user_command);
    Ok(ParentWatch {
        child_read: read,
        parent_hold: write,
    })
}

/// Loopback http(s) origin with no path, query, user, or fragment.
pub fn accepts_local_origin(origin: &str) -> bool {
    let Some(rest) = origin
        .strip_prefix("http://")
        .or_else(|| origin.strip_prefix("https://"))
    else {
        return false;
    };
    if rest.is_empty() || rest.contains(['/', '?', '#', '@']) {
        return false;
    }
    let host = if let Some(wrapped) = rest.strip_prefix('[') {
        let Some((host, after)) = wrapped.split_once(']') else {
            return false;
        };
        if !after.is_empty() && !after.starts_with(':') {
            return false;
        }
        host
    } else {
        rest.split(':').next().unwrap_or("")
    };
    matches!(host, "localhost" | "127.0.0.1" | "::1")
}

#[cfg_attr(not(windows), allow(dead_code))]
fn forward_stdio(stdout: Option<ChildStdout>, stderr: Option<ChildStderr>) {
    fn pump(stream: impl std::io::Read + Send + 'static) {
        thread::spawn(move || {
            for line in BufReader::new(stream).lines() {
                let Ok(text) = line else { break };
                log::info!(target: "engine", "{text}");
            }
        });
    }
    if let Some(out) = stdout {
        pump(out);
    }
    if let Some(err) = stderr {
        pump(err);
    }
}

fn grouped_shell(directory: &Path) -> Command {
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        let mut cmd = Command::new("/bin/sh");
        cmd.current_dir(directory)
            .stdin(Stdio::null())
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .process_group(0);
        cmd
    }
    #[cfg(windows)]
    {
        let mut cmd = Command::new(windows::system_program("cmd.exe"));
        cmd.current_dir(directory)
            .stdin(Stdio::null())
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit());
        cmd
    }
}

#[cfg(unix)]
fn signal_group(pid: u32, force: bool) {
    if pid != 0 {
        let signal = if force { libc::SIGKILL } else { libc::SIGTERM };
        unsafe { libc::killpg(pid as i32, signal) };
    }
}

#[cfg(test)]
mod snapshot_tests {
    use super::*;

    #[test]
    fn snapshot_is_empty_without_a_child() {
        let mut supervisor = Supervisor::default();
        let snap = supervisor.snapshot();
        assert!(!snap.running);
        assert!(snap.pid.is_none());
        assert!(snap.started_ms.is_none());
    }

    #[test]
    fn start_program_tracks_the_child_until_stop() {
        #[cfg(windows)]
        let (program, args) = (
            windows::system_program("waitfor.exe"),
            vec!["/t".into(), "30".into(), "BeanDeskStartProgramTest".into()],
        );
        #[cfg(unix)]
        let (program, args) = (std::path::PathBuf::from("/bin/sleep"), vec!["30".into()]);
        let mut supervisor = Supervisor::default();
        supervisor
            .start_program(&std::env::temp_dir(), &program, &args)
            .unwrap();
        assert!(supervisor.snapshot().running);
        supervisor.stop();
        assert!(!supervisor.snapshot().running);
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::process::Command;

    struct Reap(Option<Child>);

    impl Drop for Reap {
        fn drop(&mut self) {
            if let Some(child) = self.0.as_mut() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }

    fn alive(pid: u32) -> bool {
        unsafe { libc::kill(pid as i32, 0) == 0 }
    }

    #[test]
    fn local_origin_is_loopback_without_a_path() {
        assert!(accepts_local_origin("http://127.0.0.1:5000"));
        assert!(accepts_local_origin("http://localhost:5000"));
        assert!(accepts_local_origin("https://[::1]:5000"));
        assert!(!accepts_local_origin("http://127.0.0.1:5000/beancount"));
        assert!(!accepts_local_origin("http://192.168.1.8:5000"));
        assert!(!accepts_local_origin("https://books.example"));
    }

    #[test]
    fn stop_kills_only_the_group_it_started() {
        let other = Reap(Some(
            Command::new("sleep")
                .arg("30")
                .stdin(Stdio::null())
                .spawn()
                .unwrap(),
        ));
        let other_pid = other.0.as_ref().unwrap().id();

        let mut supervisor = Supervisor::default();
        supervisor.start(&std::env::temp_dir(), "sleep 30").unwrap();
        let started = supervisor.child.as_ref().unwrap().id();
        assert!(supervisor.snapshot().running);
        assert_ne!(started, other_pid);

        supervisor.stop();
        assert!(!alive(started));
        assert!(alive(other_pid));
        assert!(!supervisor.snapshot().running);
    }

    #[test]
    fn a_second_start_does_not_replace_the_live_process() {
        let mut supervisor = Supervisor::default();
        let directory = std::env::temp_dir();
        supervisor.start(&directory, "sleep 30").unwrap();
        let first = supervisor.child.as_ref().unwrap().id();
        supervisor.start(&directory, "sleep 30").unwrap();
        let second = supervisor.child.as_ref().unwrap().id();
        assert_eq!(first, second);
        let snap = supervisor.snapshot();
        assert_eq!(snap.pid, Some(first));
        assert!(snap.running);
        assert!(snap.started_ms.is_some());
    }

    #[test]
    fn snapshot_clears_after_stop_and_after_the_child_exits() {
        let mut supervisor = Supervisor::default();
        supervisor.start(&std::env::temp_dir(), "sleep 30").unwrap();
        let started = supervisor.snapshot();
        assert!(started.running);
        assert!(started.pid.is_some());
        assert!(started.started_ms.is_some());

        supervisor.stop();
        let after_stop = supervisor.snapshot();
        assert!(!after_stop.running);
        assert!(after_stop.pid.is_none());
        assert!(after_stop.started_ms.is_none());

        supervisor.start(&std::env::temp_dir(), "true").unwrap();
        let deadline = Instant::now() + Duration::from_secs(2);
        while Instant::now() < deadline && supervisor.snapshot().running {
            thread::sleep(Duration::from_millis(20));
        }
        let after_exit = supervisor.snapshot();
        assert!(!after_exit.running);
        assert!(after_exit.pid.is_none());
        assert!(after_exit.started_ms.is_none());
    }

    #[test]
    fn the_started_group_ends_when_the_parent_disappears() {
        let mut supervisor = Supervisor::default();
        supervisor
            .start(&std::env::temp_dir(), "sleep 30 & sleep 30")
            .unwrap();
        let started = supervisor.child.as_ref().unwrap().id();
        std::thread::sleep(std::time::Duration::from_millis(200));
        let kids = child_pids(started);
        assert!(
            kids.iter().any(|pid| alive(*pid)),
            "expected a live child in the started group"
        );

        supervisor.parent_hold.take();
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
        let mut leader_gone = false;
        while std::time::Instant::now() < deadline
            && (!leader_gone || kids.iter().any(|pid| alive(*pid)))
        {
            if let Some(child) = supervisor.child.as_mut() {
                leader_gone = leader_gone || matches!(child.try_wait(), Ok(Some(_)));
            }
            std::thread::sleep(std::time::Duration::from_millis(30));
        }
        assert!(
            leader_gone && kids.iter().all(|pid| !alive(*pid)),
            "process group survived the parent pipe closing"
        );
    }

    fn child_pids(parent: u32) -> Vec<u32> {
        let output = Command::new("ps")
            .args(["-axo", "pid=,ppid="])
            .output()
            .unwrap();
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|line| {
                let mut parts = line.split_whitespace();
                let pid = parts.next()?.parse::<u32>().ok()?;
                let ppid = parts.next()?.parse::<u32>().ok()?;
                (ppid == parent).then_some(pid)
            })
            .collect()
    }
}

#[cfg(all(test, windows))]
mod windows_tests {
    use super::*;
    use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
    use std::time::{Duration, Instant};
    use windows_sys::Win32::Foundation::{WAIT_OBJECT_0, WAIT_TIMEOUT};
    use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_SYNCHRONIZE, WaitForSingleObject};

    #[test]
    fn a_quoted_shell_command_keeps_descendants_in_the_job_after_the_shell_exits() {
        let directory = std::env::temp_dir().join(format!("BeanDesk Job {}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let pid_file = directory.join("child.pid");
        let _ = std::fs::remove_file(&pid_file);

        let powershell = windows::system_program(r"WindowsPowerShell\v1.0\powershell.exe");
        let command = format!(
            r#""{}" -NoProfile -NonInteractive -Command "$p = Start-Process -FilePath ping.exe -ArgumentList '-n', '31', '127.0.0.1' -PassThru -NoNewWindow; Set-Content -Path child.pid -Value $p.Id -Encoding ascii""#,
            powershell.display(),
        );
        let mut supervisor = Supervisor::default();
        supervisor.start(&directory, &command).unwrap();

        let deadline = Instant::now() + Duration::from_secs(10);
        let child = supervisor.child.as_mut().unwrap();
        let status = loop {
            if let Some(status) = child.try_wait().unwrap() {
                break status;
            }
            assert!(Instant::now() < deadline, "the command shell did not exit");
            thread::sleep(Duration::from_millis(30));
        };
        assert!(status.success());
        let pid: u32 = std::fs::read_to_string(&pid_file)
            .unwrap()
            .trim()
            .parse()
            .unwrap();
        let handle = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, 0, pid) };
        assert!(!handle.is_null(), "the descendant was not running");
        let handle = unsafe { OwnedHandle::from_raw_handle(handle) };
        assert_eq!(
            unsafe { WaitForSingleObject(handle.as_raw_handle(), 0) },
            WAIT_TIMEOUT
        );

        assert!(!supervisor.snapshot().running);
        assert_eq!(
            unsafe { WaitForSingleObject(handle.as_raw_handle(), 5000) },
            WAIT_OBJECT_0,
            "the descendant survived closing the job",
        );
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn frozen_engine_serves_a_ledger_from_a_path_with_spaces() {
        use crate::engine::{engine_args, resolve_engine};

        let Ok(engine) = resolve_engine(None) else {
            assert!(
                std::env::var_os("CI").is_none(),
                "the frozen engine is required in CI"
            );
            return;
        };
        let directory =
            std::env::temp_dir().join(format!("BeanDesk Smoke 账套 {}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        std::fs::write(
            directory.join("main.bean"),
            "option \"title\" \"Windows smoke ledger\"\n2026-01-01 open Assets:Cash CNY\n",
        )
        .unwrap();

        std::fs::write(directory.join("bad ledger.bean"), "invalid ledger\n").unwrap();
        let rejected = crate::process::background_command(&engine)
            .current_dir(&directory)
            .args(["check", "bad ledger.bean"])
            .output()
            .unwrap();
        assert!(!rejected.status.success());
        assert!(!rejected.stderr.is_empty(), "bean-check lost its diagnostics");

        let port = std::net::TcpListener::bind(("127.0.0.1", 0))
            .unwrap()
            .local_addr()
            .unwrap()
            .port();
        let origin = format!("http://127.0.0.1:{port}");
        let mut supervisor = Supervisor::default();
        supervisor
            .start_program(&directory, &engine, &engine_args(&origin).unwrap())
            .unwrap();
        let url = format!("{origin}/");
        let deadline = Instant::now() + Duration::from_secs(20);
        loop {
            assert!(supervisor.snapshot().running, "frozen Fava exited early");
            if ureq::get(&url).timeout(Duration::from_secs(1)).call().is_ok() {
                break;
            }
            assert!(
                Instant::now() < deadline,
                "frozen Fava did not answer at {url}"
            );
            thread::sleep(Duration::from_millis(100));
        }
        supervisor.stop();
        assert!(std::net::TcpStream::connect(("127.0.0.1", port)).is_err());
        std::fs::remove_dir_all(directory).unwrap();
    }
}
