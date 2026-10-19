@echo off
set "PATH=C:\Users\kimwo\AppData\Local\OpenAI\Codex\runtimes\cua_node\78fb63cda1a9e2b2\bin;C:\Users\kimwo\AppData\Local\OpenAI\Codex\runtimes\cua_node\b58ca2eaa616c2da\bin;%PATH%"
cd /d "%~dp0"
echo Building CHIP CYCLE production bundle ...
node .\node_modules\next\dist\bin\next build --webpack
