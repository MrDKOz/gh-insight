use std::sync::Mutex;
use std::time::Duration;
use tauri::State;

const GH_CANDIDATES: &[&str] = &[
    "gh",
    "/usr/local/bin/gh",
    "/opt/homebrew/bin/gh",
    "/usr/bin/gh",
    "/usr/bin/gh",
    "C:\\Program Files\\GitHub CLI\\gh.exe",
];

struct TokenCache(Mutex<Option<String>>);

fn try_gh_candidates() -> Option<String> {
    for candidate in GH_CANDIDATES {
        let result = std::process::Command::new(candidate)
            .args(["auth", "token"])
            .output();

        match result {
            Ok(output) => {
                let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !token.is_empty() {
                    return Some(token);
                }
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                if !stderr.is_empty() {
                    eprintln!("[gh-token] empty stdout for \"{}\", stderr: {}", candidate, stderr);
                }
            }
            Err(e) => {
                eprintln!("[gh-token] candidate \"{}\" failed: {}", candidate, e);
            }
        }
    }
    None
}

fn do_get_gh_token() -> Result<String, String> {
    if let Some(token) = try_gh_candidates() {
        return Ok(token);
    }

    eprintln!("[gh-token] first attempt returned no token, retrying in 600ms...");
    std::thread::sleep(Duration::from_millis(600));

    if let Some(token) = try_gh_candidates() {
        return Ok(token);
    }

    Err("GitHub CLI (gh) not found or not authenticated. Install gh from https://cli.github.com and run `gh auth login`.".to_string())
}

#[tauri::command]
fn get_gh_token(cache: State<TokenCache>) -> Result<String, String> {
    {
        let cached = cache.0.lock().unwrap();
        if let Some(token) = cached.as_ref() {
            return Ok(token.clone());
        }
    }

    let token = do_get_gh_token()?;

    {
        let mut cached = cache.0.lock().unwrap();
        *cached = Some(token.clone());
    }

    Ok(token)
}

#[tauri::command]
fn check_gh_cli(cache: State<TokenCache>) -> bool {
    get_gh_token(cache).is_ok()
}

const INIT_SCRIPT: &str = r#"
window.electronAPI = {
  isElectron: true,
  getGhToken: function() { return window.__TAURI_INTERNALS__.invoke('get_gh_token'); },
  checkGhCli: function() { return window.__TAURI_INTERNALS__.invoke('check_gh_cli'); }
};
document.addEventListener('click', function(e) {
  var a = e.target.closest('a[target="_blank"]');
  if (a && a.href) { e.preventDefault(); window.__TAURI_INTERNALS__.invoke('plugin:shell|open', { path: a.href }); }
});
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(TokenCache(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![get_gh_token, check_gh_cli])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let _window = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("GH Insight")
            .inner_size(1400.0, 900.0)
            .initialization_script(INIT_SCRIPT)
            .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
