use tauri::menu::{IsMenuItem, Menu, MenuItemBuilder, MenuItemKind, PredefinedMenuItem, Submenu};
use tauri::AppHandle;

struct Labels {
    view: &'static str,
    zoom_in: &'static str,
    zoom_out: &'static str,
    actual: &'static str,
}

fn labels(locales: &[String]) -> Labels {
    let chinese = locales.iter().any(|tag| {
        tag.split(['-', '_'])
            .next()
            .is_some_and(|primary| primary.eq_ignore_ascii_case("zh"))
    });
    if chinese {
        Labels {
            view: "显示",
            zoom_in: "放大",
            zoom_out: "缩小",
            actual: "实际大小",
        }
    } else {
        Labels {
            view: "View",
            zoom_in: "Zoom In",
            zoom_out: "Zoom Out",
            actual: "Actual Size",
        }
    }
}

/// Replace the stock View menu with one that also carries the UI zoom commands.
pub(crate) fn install(app: &AppHandle, locales: &[String]) -> tauri::Result<()> {
    let labels = labels(locales);
    let zoom_in = MenuItemBuilder::with_id("ui_zoom_in", labels.zoom_in)
        .accelerator("CmdOrCtrl+=")
        .build(app)?;
    let zoom_out = MenuItemBuilder::with_id("ui_zoom_out", labels.zoom_out)
        .accelerator("CmdOrCtrl+-")
        .build(app)?;
    let actual = MenuItemBuilder::with_id("ui_zoom_reset", labels.actual)
        .accelerator("CmdOrCtrl+0")
        .build(app)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let fullscreen = PredefinedMenuItem::fullscreen(app, None)?;

    let items: Vec<&dyn IsMenuItem<tauri::Wry>> =
        vec![&zoom_in, &zoom_out, &actual, &separator, &fullscreen];
    let view = Submenu::with_items(app, labels.view, true, &items)?;

    let menu = Menu::default(app)?;
    let mut view_index = None;
    let mut help_index = None;
    for (index, item) in menu.items()?.iter().enumerate() {
        if let MenuItemKind::Submenu(submenu) = item {
            match submenu.text()?.as_str() {
                "View" => view_index = Some(index),
                "Help" => help_index = Some(index),
                _ => {}
            }
        }
    }
    match (view_index, help_index) {
        (Some(index), _) => {
            menu.remove_at(index)?;
            menu.insert(&view, index)?;
        }
        (None, Some(index)) => menu.insert(&view, index)?,
        (None, None) => menu.append(&view)?,
    }
    app.set_menu(menu)?;
    Ok(())
}
