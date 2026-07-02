import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const routingRoot = join(process.cwd(), 'modules/ark-routing');

describe('ArkRouting native bridge contracts', () => {
  test('Android delegates to valhalla-mobile without the old CMake bridge', () => {
    const gradle = readFileSync(join(routingRoot, 'android/build.gradle'), 'utf8');
    const kotlin = readFileSync(
      join(routingRoot, 'android/src/main/java/expo/modules/arkrouting/ArkRoutingModule.kt'),
      'utf8'
    );

    expect(gradle).toContain("implementation 'io.github.rallista:valhalla-mobile:0.1.1'");
    expect(gradle).toContain('0.5.1 is compiled with Kotlin 2.3 metadata');
    expect(gradle).not.toContain('externalNativeBuild');
    expect(gradle).not.toContain('CMakeLists.txt');
    expect(kotlin).toContain('System.loadLibrary("valhalla-wrapper")');
    expect(kotlin).toContain('Class.forName("com.valhalla.valhalla.ValhallaKotlin")');
    expect(kotlin).toContain('getDeclaredMethod("route", String::class.java, String::class.java)');
    expect(kotlin).toContain('"format": "json",');
    expect(kotlin).toContain('extractValhallaError(root)');
    expect(kotlin).toContain('parseOsrmRoute(routes.getJSONObject(0))');
    expect(kotlin).toContain('byte = shape[index++].code - 63');
    expect(kotlin).toContain('result = result or ((byte and 0x1f) shl shift)');
    expect(kotlin).toContain('byte >= 0x20');
    expect(kotlin).toContain('(result shr 1).inv()');
    expect(kotlin).not.toContain('code - 63 - 1');
    expect(kotlin).not.toContain('var result = 1');
    expect(kotlin).toContain('"service_defaults"');
    expect(kotlin).toContain('"meili": {');
    expect(kotlin).toContain('"breakage_distance": 2000');
    expect(kotlin).toContain('"max_route_distance_factor": 5');
    expect(kotlin).toContain('"source_to_target_algorithm": "select_optimal"');
    expect(kotlin).toMatch(/"auto": \{\s+"max_distance": 5000000\.0,\s+"max_locations": 20,/);
    expect(kotlin).toMatch(
      /"auto_pedestrian": \{\s+"max_distance": 1000000\.0,\s+"max_locations": 50,/
    );
    expect(kotlin).toMatch(/"pedestrian": \{\s+"max_distance": 1000000\.0,\s+"max_locations": 50,/);
    expect(kotlin).toMatch(/"bicycle": \{\s+"max_distance": 1500000\.0,\s+"max_locations": 50,/);
    expect(kotlin).toMatch(
      /"hierarchy_limits": \{\s+"max_distance": 5000000\.0,\s+"max_locations": 50,/
    );
    expect(kotlin).toMatch(/"isochrone": \{\s+"max_contours": 4,/);
    expect(kotlin).toContain('"trace": {');
    expect(kotlin).toContain('"max_distance_disable_hierarchy_culling": 1000000.0');
    expect(kotlin).not.toContain('"min_linear_cost_factor"');
    expect(kotlin).not.toContain('"max_linear_cost_edges"');
    expect(kotlin).not.toContain('"allow_hard_exclusions"');
    expect(kotlin).not.toContain('"format": "json"\n        "shape_format"');
  });

  test('iOS links Valhalla through SwiftPM and exposes the same native route contract', () => {
    const swift = readFileSync(join(routingRoot, 'ios/ArkRoutingModule.swift'), 'utf8');
    const podspec = readFileSync(join(routingRoot, 'ios/ArkRouting.podspec'), 'utf8');
    const plugin = readFileSync(join(process.cwd(), 'plugins/with-ark-routing.js'), 'utf8');
    const app = readFileSync(join(process.cwd(), 'app.json'), 'utf8');

    expect(swift).toContain('import ObjectiveC.runtime');
    expect(swift).toContain('findValhallaWrapperClass()');
    expect(swift).toContain('initWithConfigPath:error:');
    expect(swift).toContain('callValhallaRoute(valhalla, requestJson: requestJson)');
    expect(swift).toContain('parseValhallaRoute(responseJson)');
    expect(swift).toContain('"format": "json",');
    expect(swift).toContain('extractValhallaError(root)');
    expect(swift).toContain('parseOsrmRoute(route)');
    expect(swift).toContain('"service_defaults"');
    expect(swift).toContain('"meili": {');
    expect(swift).toContain('"breakage_distance": 2000');
    expect(swift).toContain('"max_route_distance_factor": 5');
    expect(swift).toContain('"source_to_target_algorithm": "select_optimal"');
    expect(swift).toMatch(/"auto": \{\s+"max_distance": 5000000\.0,\s+"max_locations": 20,/);
    expect(swift).toMatch(
      /"auto_pedestrian": \{\s+"max_distance": 1000000\.0,\s+"max_locations": 50,/
    );
    expect(swift).toMatch(/"pedestrian": \{\s+"max_distance": 1000000\.0,\s+"max_locations": 50,/);
    expect(swift).toMatch(/"bicycle": \{\s+"max_distance": 1500000\.0,\s+"max_locations": 50,/);
    expect(swift).toMatch(
      /"hierarchy_limits": \{\s+"max_distance": 5000000\.0,\s+"max_locations": 50,/
    );
    expect(swift).toMatch(/"isochrone": \{\s+"max_contours": 4,/);
    expect(swift).toContain('"trace": {');
    expect(swift).toContain('"max_distance_disable_hierarchy_culling": 1000000.0');
    expect(swift).not.toContain('"min_linear_cost_factor"');
    expect(swift).not.toContain('"max_linear_cost_edges"');
    expect(swift).not.toContain('"allow_hard_exclusions"');
    expect(swift).toContain('decodePolyline6');
    expect(swift).toContain('E_ROUTING_BAD_REQUEST');
    expect(swift).toContain('E_ROUTING_FAILED');
    expect(podspec).toContain("url: 'https://github.com/Rallista/valhalla-mobile.git'");
    expect(podspec).toContain("version: '0.5.1'");
    expect(podspec).toContain("product_name: 'Valhalla'");
    expect(podspec).toContain('user_targets.each');
    expect(podspec).not.toContain("target.name == 'ArkRouting'");
    expect(plugin).toContain('$ARK_ROUTING.post_install(installer)');
    expect(app).toContain('./plugins/with-ark-routing');
  });

  test('routing docs cover Android, iOS, and remaining proof gaps', () => {
    const readme = readFileSync(join(routingRoot, 'README.md'), 'utf8');
    const todo = readFileSync(join(process.cwd(), 'TODO.md'), 'utf8');
    const architecture = readFileSync(join(process.cwd(), 'docs/architecture.md'), 'utf8');
    const v1PrepPlan = readFileSync(join(process.cwd(), 'docs/v1-prep-plan.md'), 'utf8');
    const nativeReadme = join(routingRoot, 'native/valhalla/README.md');

    expect(existsSync(nativeReadme)).toBe(true);
    expect(readme).toContain('Android and iOS now consume **valhalla-mobile**');
    expect(readme).toContain(
      "Android uses `implementation 'io.github.rallista:valhalla-mobile:0.1.1'`"
    );
    expect(readme).toContain('Legacy Android Build Helper');
    expect(readme).toContain('not used by the current Android build');
    expect(todo).toContain('Ship offline road routing');
    expect(todo).toContain('iOS simulator build now compiles/links');
    expect(architecture).toContain('iOS routing links valhalla-mobile through the app target');
    expect(v1PrepPlan).toContain('iOS simulator build now passes');
  });
});
