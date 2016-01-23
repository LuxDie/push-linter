# Push Linter

This repository is configured to lint JavaScript files on each push.

To enable this feature in your repository:
1. copy `webtask.js` to your repository root

2. create a [Github token](https://github.com/blog/1509-personal-api-tokens)
3. sign up to webtask.io
4. create a webtask through console as follows (replace the 3 strings inside "{}")

  `echo https://webtask.it.auth0.com/api/run/{webtask_container}?key=$(curl -s https://webtask.it.auth0.com/api/tokens/issue -H "Authorization: Bearer {webtask_token}" -H "Content-Type: application/json" --data-binary '{"url":"https://raw.githubusercontent.com/auth0/webtask-scripts/master/github/smarthook.js", "ectx": {"github_token": "{github_token}"}}')`

5. create a [GitHub webhook](https://developer.github.com/webhooks/) and add the previous command echo as the *Payload URL*

After that, whenever you make a push, the webtask will scan for errors and comment on each commit if it finds one.

This is an example project. Feel free to make suggestions and pull requests.