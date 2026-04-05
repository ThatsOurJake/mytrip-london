#!/bin/bash

set -euo pipefail

if [[ ! -f package.json || ! -f scripts/changelog.sh ]]; then
    echo "Run this script from the project root."
    exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
    echo "jq could not be found"
    exit 1
fi

CURRENT_VERSION="$(jq -r '.version' package.json)"

if [[ ! "$CURRENT_VERSION" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    echo "Current version '$CURRENT_VERSION' is not a simple semver version."
    exit 1
fi

MAJOR="${BASH_REMATCH[1]}"
MINOR="${BASH_REMATCH[2]}"
PATCH="${BASH_REMATCH[3]}"

RELEASE_TYPE="${1:-}"
while [[ "$RELEASE_TYPE" != "major" && "$RELEASE_TYPE" != "minor" && "$RELEASE_TYPE" != "patch" ]]; do
    read -r -p "Increase version by (major/minor/patch): " RELEASE_TYPE
done

case "$RELEASE_TYPE" in
    major)
        NEW_VERSION="$((MAJOR + 1)).0.0"
    ;;
    minor)
        NEW_VERSION="$MAJOR.$((MINOR + 1)).0"
    ;;
    patch)
        NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
    ;;
esac

echo "Current version: $CURRENT_VERSION"
echo "New version: $NEW_VERSION"
echo
echo "Enter the release changes."

CHANGE_LINES=()
while true; do
    read -r -p "Change (leave blank to finish): " LINE
    if [[ -z "$LINE" ]]; then
        break
    fi
    CHANGE_LINES+=("$LINE")
done

if [[ ${#CHANGE_LINES[@]} -eq 0 ]]; then
    echo "At least one changelog entry is required."
    exit 1
fi

TODAY="$(date +%F)"
CHANGELOG_FILE="changelogs/${TODAY}-v${NEW_VERSION}.md"

mkdir -p changelogs

TMP_PACKAGE_JSON="$(mktemp)"
jq --arg version "$NEW_VERSION" '.version = $version' package.json > "$TMP_PACKAGE_JSON"
mv "$TMP_PACKAGE_JSON" package.json

{
    echo "# v$NEW_VERSION - $TODAY"
    echo
    for CHANGE in "${CHANGE_LINES[@]}"; do
        echo "- $CHANGE"
    done
} > "$CHANGELOG_FILE"

echo
echo "Updated package.json to v$NEW_VERSION"
echo "Changelog written to $CHANGELOG_FILE"
