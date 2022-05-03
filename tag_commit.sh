

git rm -r --cached .
git add .

git commit -m "${1}"
npm version patch
git push -u origin main --tags