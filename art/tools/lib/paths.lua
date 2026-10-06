-- Repo paths for every Aseprite Lua tool, derived from the global ROOT.
-- Run: set ROOT = "<repo root, forward slashes>" in the run_lua_script call, then
--   local P = dofile(ROOT .. "/art/tools/lib/paths.lua")
-- Aseprite's dofile needs an absolute path, so ROOT is the one value a caller sets.
if type(ROOT) ~= "string" or ROOT == "" then
  error('set ROOT = "<repo root>" (the absolute repo path, forward slashes) before dofile')
end

local P = {}
P.ROOT = (ROOT:gsub("\\", "/"):gsub("/+$", ""))
P.ART = P.ROOT .. "/art"
P.AVATAR = P.ART .. "/avatar"
P.ROOM = P.ART .. "/room"
P.PALETTE = P.ART .. "/palette.gpl"
P.BODY = P.AVATAR .. "/body.aseprite"
P.TOOLS = P.ART .. "/tools"
-- Previews are scratch output: .superpowers/ is gitignored and never committed.
P.PREVIEWS = P.ROOT .. "/.superpowers/art-previews"

-- Returns P.PREVIEWS (or a subfolder of it), creating it first.
function P.previews(sub)
  local dir = sub and (P.PREVIEWS .. "/" .. sub) or P.PREVIEWS
  app.fs.makeAllDirectories(dir)
  return dir
end

return P
