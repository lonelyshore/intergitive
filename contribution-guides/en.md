# Contribution Guide  

Welcom! `intergitive` appreciates any contribution.  

Contributions can mostly be made in two aspects: changes of main program or changes of tutorial contents. No matter which kind of contributions you would like to make, this guide will help you jump start.  

## Recommended Environment

Most part of `intergitive` is developed under the following environment settings. It is highly recommended to use the same settings to avoid possible errors caused by differences in environment.

- Windows 10
- PowerShell v5.1
- node v12.20.2
- npm v6.14.11
- VS code v1.46
  - ESLint v2.1.8: Currently this project adopts [JavaScript Standard style](https://standardjs.com/) because it needs least manual modifications while the project starting linting after a long time of development.
  - Vetur 0.24.0
  - vue 0.1.5
  - YAML 0.16.0

## Recommended Steps

### Initialize Project

- Clone the repository to your computer.  
- Open PowerShell. Change directory to the cloned project. If no extra notion is provided, we assume that "execute command" means executing PowerShell command in the project directory.  
- Install npm packages: execute command `npm install`
- **Important**: install `nodegit` (a package allows `intergitive` to operate git)。One may choose to install it via a script or manually (if you don't trust the installtion script)
  - Via the script
    - Allow PowerShell to execute scripts: execute command `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process`  
    - Run the script: execute `.\post-npm-install-win.ps1 -architecture x64`
  - Manually. We will install `nodegit` for running in node and electron. We also maintain a cache for switching between the two modes quickly. 
    - Initialize cache: execute `node .\dev\module-switch.js init`
    - Clean up existing cache (one may skip this step if it is the first time of cloning `intergitive`): execute `node .\dev\module-switch.js drop nodegit`
    - Install `nodegit` for electron
      - Create `.npmrc` and fill in the following contents. If the file already exists, overwrite it:  
    ```
$content = @"
runtime = electron
target = 8.2.0
target_arch = $architecture
disturl = "https://atom.io/download/atom-shell"
    ```  
      - Install `nodegit`: execute `npm install nodegit@0.26.x`
      - Cache it: execute `node .\dev\module-switch.js save nodegit electron`
    - Install `nodegit` for node
      - Delete `.npmrc`
      - Install `nodegit`: execute `npm install nodegit@0.26.x`  
      - Cache it: execute `node .\dev\module-switch.js save nodegit node` 

### Check if Initialized Successfully

- Run tests in node: execute `npm run test` (takes about 5-10 minutes)
- Run tests in electron: execute `npm run etest` (takes about 5-10 minutes)
- Execute the program: execute `npm run test-pack`

### NPM Commands

Here are a brief list of NPM commands that might be useful
- `load-native-node`: switch NPM native packages to node mode
- `load-native-electron`: switch NPM native packages to electron mode
- `test`: run tests in node
- `check-course`: checks if any assets used in tutorials is missing
- `etest`: run tests in electron
- `lint`: run style checks
- `fix-lint`: run style checks and try fix it automatically
- `pack`: pack the project in production mode. The entry point of packed product is `main.js` in the project folder
- `pack-dev`: pack the project in development mode. The entry point of packed product is `main.js` in the project folder
- `test-pack`: pack and execute the project in development mode
- `test-pack-production`: pack and execute the project in production mode
- `build-pack-win64`: pack the project in production mode and bundle it into the `out` folder. Please ensure the folder is empty before execution

### Before Pushing Commits

- Please be sure the style checks are passed: execute `npm run lint` or `npm run fix-lint` to fix errors automatically
- Please be sure that all tests are passed: execute `npm run test`
