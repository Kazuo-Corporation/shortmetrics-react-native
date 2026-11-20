# Publishing Guide

This guide will help you publish your ShortMetrics package to npm.

## Prerequisites

1. **npm account**: Create one at https://www.npmjs.com/signup
2. **npm CLI**: Should be installed with Node.js
3. **Verified email**: Your npm account email must be verified

## Pre-Publishing Checklist

### 1. Update Package Information

Edit `package.json`:

```json
{
  "name": "@kazuocorporation/shortmetrics-react-native",  // Change @yourorg to your npm username/org
  "version": "1.1.0",
  "description": "Event tracking SDK for React Native and Expo apps",
  "author": "Your Name <your.email@example.com>",
  "repository": {
    "type": "git",
    "url": "https://github.com/kazuocorporation/shortmetrics-react-native.git"
  },
  "bugs": {
    "url": "https://github.com/kazuocorporation/shortmetrics-react-native/issues"
  },
  "homepage": "https://github.com/kazuocorporation/shortmetrics-react-native#readme"
}
```

### 2. Choose a Package Name

Options:
- **Scoped package** (recommended): `@kazuocorporation/shortmetrics-react-native`
  - Requires npm organization or your username
  - Can be private or public
  - Better namespacing

- **Unscoped package**: `shortmetrics-react-native`
  - Must be unique across all of npm
  - Always public
  - Simpler name

Check availability:
```bash
npm search shortmetrics-react-native
```

### 3. Initialize Git Repository (if not already)

```bash
cd /home/johnny/shortmetrics-react-native
git init
git add .
git commit -m "Initial commit"
```

Optionally, create a GitHub repository and push:
```bash
git remote add origin https://github.com/kazuocorporation/shortmetrics-react-native.git
git branch -M main
git push -u origin main
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Build the Package

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### 6. Test Locally

Test in a local React Native project before publishing:

```bash
# In package directory
npm pack
# This creates: kazuocorporation-shortmetrics-react-native-1.1.0.tgz

# In your test project
npm install /path/to/shortmetrics-react-native/kazuocorporation-shortmetrics-react-native-1.1.0.tgz

# Or using a relative path
npm install ../shortmetrics-react-native/kazuocorporation-shortmetrics-react-native-1.1.0.tgz
```

Test all functionality in your test app before proceeding. For 1.1.0, also check that events tracked offline are sent once the network is back, and that the rows in BigQuery `event_tracking.pixel_events` carry the device signals (`platform` = ios/android on every event, `social_platform` on `custom_attribution_post_url`).

## Publishing Steps

### 1. Login to npm

```bash
npm login
# Enter your username, password, and email
```

Verify you're logged in:
```bash
npm whoami
```

### 2. Publish to npm

For scoped packages (first time):
```bash
npm publish --access public
```

For subsequent updates or unscoped packages:
```bash
npm publish
```

### 3. Verify Publication

Check your package page:
```
https://www.npmjs.com/package/@kazuocorporation/shortmetrics-react-native
```

## Version Management

Use semantic versioning (semver):
- **1.0.0** - Initial release
- **1.0.1** - Bug fixes (patch)
- **1.1.0** - New features (minor)
- **2.0.0** - Breaking changes (major)

### Publishing Updates

1. Make your changes and add an entry to `CHANGELOG.md`
2. Update version in `package.json`:

```bash
# For patches (1.0.0 -> 1.0.1)
npm version patch

# For minor updates (1.0.0 -> 1.1.0)
npm version minor

# For major updates (1.0.0 -> 2.0.0)
npm version major
```

This automatically:
- Updates `package.json`
- Creates a git tag
- Commits the change

3. Build and publish:

```bash
npm run build
npm publish
```

4. Push to git:

```bash
git push
git push --tags
```

## Testing the Published Package

Install in a new project:

```bash
# Create test Expo app
npx create-expo-app test-tracker
cd test-tracker
npm install @kazuocorporation/shortmetrics-react-native @react-native-async-storage/async-storage

# Or for React Native
npx react-native init TestTracker
cd TestTracker
npm install @kazuocorporation/shortmetrics-react-native @react-native-async-storage/async-storage
```

## CI/CD Setup (Optional)

### GitHub Actions

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Add your npm token to GitHub secrets:
1. Generate token: https://www.npmjs.com/settings/[username]/tokens
2. Add to GitHub: Repository Settings > Secrets > New secret
3. Name: `NPM_TOKEN`

## Unpublishing (Emergency Only)

⚠️ **Warning**: Only unpublish within 72 hours of publishing.

```bash
npm unpublish @kazuocorporation/shortmetrics-react-native@1.0.0
```

For specific version:
```bash
npm unpublish @kazuocorporation/shortmetrics-react-native@1.0.1
```

## Common Issues

### "Package name not available"
- Choose a different name
- Use a scoped package: `@kazuocorporation/shortmetrics-react-native`

### "You must verify your email"
- Check your npm account email
- Click the verification link

### "You do not have permission to publish"
- Ensure you're logged in: `npm whoami`
- Check organization permissions

### "Invalid package.json"
- Validate with: `npm pkg fix`
- Check required fields: name, version, main

### Build errors
- Delete `dist/` and rebuild: `npm run clean && npm run build`
- Check TypeScript errors: `npx tsc --noEmit`

## Best Practices

1. **Test thoroughly** before publishing
2. **Document breaking changes** in README
3. **Use semantic versioning** correctly
4. **Keep README updated** with latest features
5. **Add examples** for common use cases
6. **Respond to issues** on GitHub/npm
7. **Tag releases** on GitHub
8. **Write changelogs** for each version

## Maintenance

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update dependencies
npm update

# Update to latest (carefully)
npm install @react-native-async-storage/async-storage@latest
```

### Deprecating Versions

```bash
npm deprecate @kazuocorporation/shortmetrics-react-native@1.0.0 "This version has a critical bug. Please upgrade to 1.0.1"
```

### Adding Maintainers

```bash
npm owner add username @kazuocorporation/shortmetrics-react-native
```

## Resources

- npm Documentation: https://docs.npmjs.com/
- Semantic Versioning: https://semver.org/
- npm Package Best Practices: https://docs.npmjs.com/packages-and-modules
- TypeScript Publishing: https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html

## Support

If you encounter issues during publishing:
1. Check npm status: https://status.npmjs.org/
2. Review npm docs: https://docs.npmjs.com/
3. Ask in npm community: https://npm.community/

