# SDK Source

Clone into `{baseDir}/tmp/superwall-sdks/`. If the directory already exists, `git pull` instead of re-cloning.

| SDK | Repo | Branch |
|-----|------|--------|
| iOS | `https://github.com/superwall/Superwall-iOS.git` | `develop` |
| Android | `https://github.com/superwall/Superwall-Android.git` | `develop` |
| Flutter | `https://github.com/superwall/Superwall-Flutter.git` | `main` |
| React Native | `https://github.com/superwall/react-native-superwall.git` | `main` |

```bash
# Clone
git clone -b {branch} {repo} {baseDir}/tmp/superwall-sdks/{sdk}

# Update existing
git -C {baseDir}/tmp/superwall-sdks/{sdk} pull
```
