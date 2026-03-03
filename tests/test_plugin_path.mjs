import { dirname, join, resolve } from "path"
import { fileURLToPath } from "url"
import { existsSync } from "fs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const pluginDir = resolve(__dirname, "..")
const notify_hook_script = process.env.NOTIFY_HOOK_SCRIPT || join(pluginDir, "notify.sh")

console.log("Plugin dir:", pluginDir)
console.log("Resolved notify_hook_script:", notify_hook_script)
console.log("File exists:", existsSync(notify_hook_script))
console.log("Is executable:", existsSync(notify_hook_script) && process.platform === 'darwin')

// Test from different directory
process.chdir('/tmp')
const notify_hook_script2 = process.env.NOTIFY_HOOK_SCRIPT || join(pluginDir, "notify.sh")
console.log("\nFrom /tmp:")
console.log("Resolved notify_hook_script:", notify_hook_script2)
console.log("File exists:", existsSync(notify_hook_script2))
