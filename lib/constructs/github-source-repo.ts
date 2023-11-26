export interface GithubSourceRepo {
    readonly githubOwnerAlias: string;
    readonly githubRepo: string;
    readonly githubBranch: string;
    readonly githubAuthTokenSecretAlias: string;
}