const remoteProjectOwner = `getElementsByName`;
const remoteProjectName = `project-template`;
const localScope = `@why`;

module.exports = {

    getRemoteURL: (options = {branchName: "master"}) => {
        return `git+https://github.com/${remoteProjectOwner}/${remoteProjectName}.git#${options.branchName}`
    },

    localPath: `./node_modules/${localScope}/${remoteProjectName}/template`
};