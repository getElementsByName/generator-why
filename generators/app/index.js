const Generator = require("yeoman-generator");
const fs = require('fs');
const path = require('path');
const TemplateDataModel = require("./TemplateDataModel");
const PromptConfig = require("../PromptConfig");
const projectTemplate = require("../projectTemplateInfo");
const DummyPackageJson = require("./DummyPackageJson");


class WebpackGenerator extends Generator {
    constructor(args, opts) {
        super(args, opts);

        const templatePath = projectTemplate.localPath;
        this.templateData = new TemplateDataModel();
        this.sourceRoot(templatePath);

        // 템플릿 다운을 위해 임시로 생성한 경우를 판단하기 위한 플래그
        // 해당 플래그가 true이면 템플릿 생성 전에 package.json을 삭제
        this._isPackagejsonCreated = null;
    }

    _getCurrentFolderName() {
        const rootFolderPath = this.destinationRoot();
        return rootFolderPath.match(/[^\/\\]*$/)[0];
    }

    _createInitPackageJson() {
        const packagejsonPath = this.destinationPath('package.json');

        if (fs.existsSync(packagejsonPath)) {
            this._isPackagejsonCreated = false
        } else {
            const dummyPackageJson = DummyPackageJson.getJSON({name: this.templateData.project.name});
            const dummyPackageJsonString = JSON.stringify(dummyPackageJson, null, 2);

            fs.writeFileSync(packagejsonPath, dummyPackageJsonString);

            this._isPackagejsonCreated = true;
        }
    }

    prompting() {
        const projectNamePrompt = PromptConfig.projectName;
        projectNamePrompt.default = this._getCurrentFolderName();

        return this.prompt([projectNamePrompt, PromptConfig.projectTypeList]).then(({projectName, projectType}) => {
            this.templateData.setProjectName(projectName);

            if (projectType) {
                return {projectType};
            } else {    // 직접 입력인 경우
                return this.prompt([PromptConfig.projectTypeGeneral]);
            }
        }).then(({projectType}) => {
            this.templateData.project.type = projectType;

            // TODO: 하드코딩 되어 있는 부분 일반화 시키기
            const searchPromptInfo =  PromptConfig.projectTypeExtraPrompt[0];
            const targetProjectType = searchPromptInfo.test.project.type;
            const containerName = searchPromptInfo.containerName;
            const promptList = searchPromptInfo.promptList;

            if (projectType.includes(targetProjectType)) {
                return this.prompt(promptList).then(({answer})=>{
                    return {
                        containerName,
                        answer
                    }
                });
            } else {
                return {};
            }
        }).then(({answer, containerName}) => {
            if (answer) {
                // TODO: 추가 container에 namespace 정의하도록 변경 필요
                this.templateData.project.namespaceList
                    = answer.namespaceList.concat([this.templateData.project.name.camel]);

                this.templateData[containerName] = answer.search;
            }
        });
    }

    _installNpm(packageName) {
        return new Promise((resolve, reject) => {
            this.spawnCommand("npm", ["install", packageName, '--prefer-offline'])
                .on('error', (err) => {
                    reject(err);
                })
                .on('exit', (err) => {
                    err && reject(err);
                    resolve();
                });
        });
    }

    configuring() {
        console.log(`---- Start to create '${this.templateData.project.name.input}' project. ----`);
        this._createInitPackageJson();
    }

    _renameFiles() {
        const gitIgnorePath = path.join(this.destinationPath(), "./__.gitignore");
        const npmRcPath = path.join(this.destinationPath(), "./__.npmrc");

        this.fs.exists(gitIgnorePath) &&
            this.fs.move(gitIgnorePath, path.join(this.destinationPath(), "./.gitignore"));
        this.fs.exists(npmRcPath) &&
            this.fs.move(npmRcPath, path.join(this.destinationPath(), "./.npmrc"));
    }

    writing() {
        const remoteURL = projectTemplate.getRemoteURL({branchName: this.templateData.project.type});
        console.log(`1. fetch project template from remote (${remoteURL})`);
        return this._installNpm(remoteURL).then(() => {

            if (this._isPackagejsonCreated) {   // 초기에 package.json이 이미 있었던 경우는 유지
                // 	// git remote template을 설치하기 위한 package.json 제거
                fs.unlink(this.destinationPath("package.json"));
            }

            console.log(`2. copy project template`);
            const tplData = this.templateData;
            tplData.user.name = this.user.git.name();
            tplData.user.email = this.user.git.email();

            this.fs.copyTpl(
                this.templatePath(),
                this.destinationPath(),
                tplData,
                {},
                {globOptions: {dot: true}}
            );

            this._renameFiles();
        });
    }

    install() {
        console.log(`3. install package`);

        return this.installDependencies({
            npm: true,
            bower: false,
            yarn: false,
            callback: () => {
                console.log(`\nDone!! Run by 'npm start'`);
            }
        });
    }
}

module.exports = WebpackGenerator;

/**
 initializing - Your initialization methods (checking current project state, getting configs, etc)
 prompting - Where you prompt users for options (where you'd call this.prompt())
 configuring - Saving configurations and configure the project (creating .editorconfig files and other metadata files)
 default - If the method name doesn't match a priority, it will be pushed to this group.
 writing - Where you write the generator specific files (routes, controllers, etc)
 conflicts - Where conflicts are handled (used internally)
 install - Where installations are run (npm, bower)
 end - Called last, cleanup, say good bye, etc
 **/