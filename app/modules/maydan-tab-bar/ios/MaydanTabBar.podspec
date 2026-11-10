Pod::Spec.new do |s|
  s.name = 'MaydanTabBar'
  s.version = '1.0.0'
  s.summary = 'Native iOS tab bar for Maydan'
  s.description = 'Hosts the iOS tab bar while Maydan owns its existing screen navigation.'
  s.homepage = 'https://github.com/Kaido1070/Maydan'
  s.license = { :type => 'UNLICENSED' }
  s.author = 'Maydan'
  s.source = { :git => 'https://github.com/Kaido1070/Maydan.git' }
  s.platform = :ios, '16.4'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '*.swift'
end
