use tauri::{
    Emitter, Manager,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

#[derive(Clone, serde::Serialize)]
struct PlatformAction {
    action: String,
    payload: Option<String>,
}

pub fn setup(app: &mut tauri::App) -> tauri::Result<()> {
    setup_tray(app)?;
    setup_deep_links(app)?;
    Ok(())
}

fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let quick_capture =
        MenuItem::with_id(app, "quick-capture", "Quick capture", true, None::<&str>)?;
    let show_main = MenuItem::with_id(app, "show-main", "Show Scriptor", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&quick_capture, &show_main, &quit])?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Scriptor")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quick-capture" => {
                let _ = app.emit(
                    "platform:action",
                    PlatformAction {
                        action: "quick-capture".into(),
                        payload: None,
                    },
                );
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "show-main" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn setup_deep_links(app: &mut tauri::App) -> tauri::Result<()> {
    #[cfg(any(target_os = "linux", target_os = "windows", target_os = "macos"))]
    {
        use tauri_plugin_deep_link::DeepLinkExt;
        let handle = app.handle().clone();
        app.deep_link().register("scriptor").map_err(|error| {
            tauri::Error::Io(std::io::Error::other(error.to_string()))
        })?;
        let _ = app.deep_link().on_open_url(move |event| {
            for url in event.urls() {
                let _ = handle.emit(
                    "platform:deep-link",
                    PlatformAction {
                        action: "deep-link".into(),
                        payload: Some(url.to_string()),
                    },
                );
            }
        });
    }
    Ok(())
}
