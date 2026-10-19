@echo off
set "PATH=C:\Users\kimwo\AppData\Local\OpenAI\Codex\runtimes\cua_node\78fb63cda1a9e2b2\bin;C:\Users\kimwo\AppData\Local\OpenAI\Codex\runtimes\cua_node\b58ca2eaa616c2da\bin;%PATH%"
cd /d "%~dp0"
echo Starting CHIP CYCLE local development server on http://localhost:3000 ...
node .\node_modules\next\dist\bin\next dev --webpack --port 3000
