use std::ffi::OsStr;
use std::process::Command;

#[cfg(windows)]
pub(crate) mod windows;

/// Run a CLI helper without opening a console from the desktop application.
pub(crate) fn background_command(program: impl AsRef<OsStr>) -> Command {
    let command = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use windows_sys::Win32::System::Threading::CREATE_NO_WINDOW;

        let mut command = command;
        command.creation_flags(CREATE_NO_WINDOW);
        command
    }
    #[cfg(not(windows))]
    {
        command
    }
}
