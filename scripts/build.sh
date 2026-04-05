# !/bin/bash

if ! command -v jq >/dev/null 2>&1
then
    echo "jq could not be found"
    exit 1
fi

VERSION=$(jq '.version' package.json)

docker build -t registry.sussy-servers.uk/public/my-trip-london:$VERSION .
docker build -t registry.sussy-servers.uk/public/my-trip-london:latest .

docker push registry.sussy-servers.uk/public/my-trip-london:$VERSION
docker push registry.sussy-servers.uk/public/my-trip-london:latest
