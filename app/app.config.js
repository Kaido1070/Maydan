module.exports = ({ config }) => {
  const iosClientId = config.extra?.googleIosClientId;
  const match = typeof iosClientId === 'string' && /^([0-9]+-[A-Za-z0-9_-]+)\.apps\.googleusercontent\.com$/.exec(iosClientId);
  if (!match) return config;
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ['@react-native-google-signin/google-signin', { iosUrlScheme: `com.googleusercontent.apps.${match[1]}` }],
    ],
  };
};
