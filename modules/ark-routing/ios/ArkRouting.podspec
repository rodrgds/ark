$ARK_ROUTING_SPM_SPEC ||= {
  url: 'https://github.com/Rallista/valhalla-mobile.git',
  requirement: {
    kind: 'exactVersion',
    version: '0.5.1'
  },
  product_name: 'Valhalla'
}

$ARK_ROUTING = Object.new

def $ARK_ROUTING.add_spm_to_target(project, target, spec)
  return unless target

  pkg_class = Xcodeproj::Project::Object::XCRemoteSwiftPackageReference
  ref_class = Xcodeproj::Project::Object::XCSwiftPackageProductDependency

  pkg = project.root_object.package_references.find do |package|
    package.class == pkg_class && package.repositoryURL == spec[:url]
  end

  unless pkg
    pkg = project.new(pkg_class)
    pkg.repositoryURL = spec[:url]
    project.root_object.package_references << pkg
  end

  pkg.requirement = spec[:requirement]

  ref = target.package_product_dependencies.find do |dependency|
    dependency.class == ref_class &&
      dependency.package == pkg &&
      dependency.product_name == spec[:product_name]
  end

  unless ref
    ref = project.new(ref_class)
    ref.package = pkg
    ref.product_name = spec[:product_name]
    target.package_product_dependencies << ref
  end
end

def $ARK_ROUTING.post_install(installer)
  spec = $ARK_ROUTING_SPM_SPEC

  installer.aggregate_targets.group_by(&:user_project).each do |project, targets|
    targets.each do |target|
      target.user_targets.each do |user_target|
        add_spm_to_target(project, user_target, spec)
      end
    end
  end
end

Pod::Spec.new do |s|
  s.name           = 'ArkRouting'
  s.version        = '1.0.0'
  s.summary        = 'Native offline routing bridge for Ark'
  s.description    = 'Provides a Valhalla-backed offline routing bridge for Ark navigation.'
  s.author         = 'Ark'
  s.homepage       = 'https://github.com/ark-offline/ark'
  s.license        = 'MIT'
  s.platform       = :ios, '16.4'
  s.source         = { git: 'https://github.com/ark-offline/ark.git' }
  s.static_framework = true
  s.swift_version  = '5.8'
  s.source_files   = '**/*.swift'
  s.dependency 'ExpoModulesCore'
end
