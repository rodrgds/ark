Android SDK is working. Implement these features:

- Interest points on the mapsd with farmacies, local markets, shoppings, etc
- More detailed maps, houses, green spaces, more detailed roads, preferably 3d buildings as well

Refer to maplibre react native documentation:

Map
A view of a MapLibre Native Map.

Rendering a basic Map

   <Map mapStyle="https://demotiles.maplibre.org/style.json" />

Also accepts props from: ViewProps

Props
style
Style for wrapping React Native View

Type: ViewProps["style"]

Required: No

Default: { flex: 1 }

mapStyle
Maplibre style - either a URL or a Style JSON.

Type: string | StyleSpecification

Required: Yes

See also: https://maplibre.org/maplibre-style-spec/

light
Light properties of the style. Must conform to the Light Style Specification. Controls the light source for extruded
geometries.

Type: LightSpecification

Required: No

contentInset
The distance from the edges of the map view's frame to the edges of the map view's logical viewport.

Type: ViewPadding

Required: No

preferredFramesPerSecond
iOS: The preferred frame rate at which the map view is rendered. The default value for this property is
MLNMapViewPreferredFramesPerSecondDefault, which will adaptively set the preferred frame rate based on the capability of
the user’s device to maintain a smooth experience. This property can be set to arbitrary integer values. Android: The
maximum frame rate at which the map view is rendered, but it can't exceed the ability of device hardware. This property
can be set to arbitrary integer values.

Type: number

Required: No

dragPan
Toggle pan interaction of the map

Type: boolean

Required: No

Default: true

touchZoom
Toggle pinch/scroll zoom interaction of the map. On Android this also disables doubleTapZoom and doubleTapHoldZoom.

Type: boolean

Required: No

Default: true

doubleTapZoom
Toggle double-tap zoom interaction of the map.

Type: boolean

Required: No

Default: true

doubleTapHoldZoom
Toggle double-tap-and-hold zoom interaction of the map (also known as quick zoom and one finger zoom).

Type: boolean

Required: No

Default: true

touchRotate
Toggle rotate interaction of the map

Type: boolean

Required: No

Default: true

touchPitch
Toggle pitch interaction of the map

Type: boolean

Required: No

Default: true

tintColor
Tints UI elements like the attribution button

Type: string

Required: No

attribution
Toggle the attribution button of the map

Type: boolean

Required: No

attributionPosition
Positions the attribution button

Type: OrnamentViewPosition

Required: No

logo
Toggle the logo on the map

Type: boolean

Required: No

logoPosition
Positions the logo

Type: OrnamentViewPosition

Required: No

compass
Toggle the compass from appearing on the map

Type: boolean

Required: No

compassPosition
Positions the compass

Type: OrnamentViewPosition

Required: No

compassHiddenFacingNorth
Toggle the compass from hiding when facing north

Type: boolean

Required: No

Default: true

scaleBar
Toggle the scale bar on the map

Type: boolean

Required: No

scaleBarPosition
Positions the scale bar. Android only supports top-left corner.

Type: OrnamentViewPosition

Required: No

androidView
Android only: Switch between TextureView (default) and GLSurfaceView for rendering the map

Type: "surface" | "texture"

Required: No

Default: "surface"

onPress
Called when a user presses the map If the event bubbles up from a child Source with an onPress handler the features will
be included. The event will emit on Map and Source . To prevent this use event.stopPropagation() in the Source handler.

Type:

(
event:
| NativeSyntheticEvent<PressEvent>
| NativeSyntheticEvent<PressEventWithFeatures>,
) => void

Required: No

onLongPress
Called when a user long presses the map

Type: (event: NativeSyntheticEvent<PressEvent>) => void

Required: No

onRegionWillChange
Called when the currently displayed map region is about to change

Type:

(
event: NativeSyntheticEvent<ViewStateChangeEvent>,
) => void

Required: No

onRegionIsChanging
Called when the currently displayed map region is changing

Type:

(
event: NativeSyntheticEvent<ViewStateChangeEvent>,
) => void

Required: No

onRegionDidChange
Called when the currently displayed map region finished changing

Type:

(
event: NativeSyntheticEvent<ViewStateChangeEvent>,
) => void

Required: No

onWillStartLoadingMap
Called when the map is about to start loading a new map style

Type: (event: NativeSyntheticEvent<null>) => void

Required: No

onDidFinishLoadingMap
Called when the map has successfully loaded a new map style

Type: (event: NativeSyntheticEvent<null>) => void

Required: No

onDidFailLoadingMap
Called when the map has failed to load a new map style

Type: (event: NativeSyntheticEvent<null>) => void

Required: No

onWillStartRenderingFrame
Called when the map will start rendering a frame

Type: (event: NativeSyntheticEvent<null>) => void

Required: No

onDidFinishRenderingFrame
Called when the map finished rendering a frame

Type: (event: NativeSyntheticEvent<null>) => void

Required: No

onDidFinishRenderingFrameFully
Called when the map fully finished rendering a frame

Type: (event: NativeSyntheticEvent<null>) => void

Required: No

onWillStartRenderingMap
Called when the map will start rendering itself

Type: (event: NativeSyntheticEvent<null>) => void

Required: No

onDidFinishRenderingMap
Called when the map has finished rendering itself

Type: (event: NativeSyntheticEvent<null>) => void

Required: No

onDidFinishRenderingMapFully
Called when the map has fully finished rendering itself

Type: (event: NativeSyntheticEvent<null>) => void

Required: No

onDidFinishLoadingStyle
Triggered when a style has finished loading

Type: (event: NativeSyntheticEvent<null>) => void

Required: No

ref
Ref to access Map methods.

Type: Ref<MapRef>

Required: No

testID
Type: string

Required: No

Ref Methods
getCenter()
Returns the current center coordinates of the map

Returns: Promise<LngLat> — Current center coordinates of the map

await mapRef.current?.getCenter();

getZoom()
Returns the current zoom level of the map

Returns: Promise<number> — Current zoom level of the map

await mapRef.current?.getZoom();

getBearing()
Returns the current bearing of the map

Returns: Promise<number> — Current bearing of the map

await mapRef.current?.getBearing();

getPitch()
Returns the current pitch of the map

Returns: Promise<number> — Current pitch of the map

await mapRef.current?.getPitch();

getBounds()
Returns the current bounds of the map

Returns: Promise<LngLatBounds> — Current bounds of the map

await mapRef.current?.getBounds();

getViewState()
Returns the current view state of the map

Returns: Promise<ViewState> — Current view state of the map

await mapRef.current?.getViewState();

project(lngLat)
Converts geographic coordinates to pixel point of the view

lngLat
Geographic coordinate

Type: LngLat

Required: Yes

Returns: Promise<PixelPoint> — Pixel point

await mapRef.current?.project([13.04214014753952, 47.80554907882145]);

unproject(point)
Converts a pixel point of the view to geographic coordinates.

point
Pixel point

Type: PixelPoint

Required: Yes

Returns: Promise<LngLat> — Geographic coordinate

await mapRef.current?.unproject([280, 640]);

queryRenderedFeatures(pixelPoint, [options])
Query rendered features at a point

pixelPoint
Type: PixelPoint

Required: Yes

options
Type: QueryRenderedFeaturesOptions

Required: No

Returns: Promise<GeoJSON.Feature[]> — Queried features

await mapRef.current?.queryRenderedFeatures([240, 640], {
filter: ["==", "type", "Point"],
layers: ["restaurants", "shops"],
});

queryRenderedFeatures(pixelPointBounds, [options])
Query rendered features within pixel bounds

pixelPointBounds
Type: PixelPointBounds

Required: Yes

options
Type: QueryRenderedFeaturesOptions

Required: No

Returns: Promise<GeoJSON.Feature[]> — Queried features

await mapRef.current?.queryRenderedFeatures([100, 100, 400, 400], {
filter: ["==", "type", "Point"],
layers: ["restaurants", "shops"],
});

queryRenderedFeatures([options])
Query rendered features within the current viewport

options
Type: QueryRenderedFeaturesOptions

Required: No

Returns: Promise<GeoJSON.Feature[]> — Queried features

await mapRef.current?.queryRenderedFeatures({
filter: ["==", "type", "Point"],
layers: ["restaurants", "shops"],
});

createStaticMapImage(options)
Takes static-map image of the currently displayed map

options
Type: { output: "base64" | "file" }

Required: Yes

Returns: Promise<string> — Base64 encoded image or URI of image file

setSourceVisibility(visible, source, [sourceLayer])
Sets the visibility of all the layers referencing the specified source and optionally sourceLayer

visible
Visibility of the layers

Type: boolean

Required: Yes

source
Identifier of the target source (e.g. 'composite')

Type: string

Required: Yes

sourceLayer
Identifier of the target source-layer (e.g. 'building')

Type: string

Required: No

Returns: Promise<void>

await mapRef.current?.setSourceVisibility(false, "composite", "building");

showAttribution()
Show the attribution dialog Can be used to implement a custom attribution button.

Returns: Promise<void>

Types
OrnamentViewPosition
Screen position for map ornaments (logo, compass, scale bar). Exactly one of top / bottom and one of left / right must be
provided.

type OrnamentViewPosition =
| { top: number; left: number }
| { top: number; right: number }
| { bottom: number; right: number }
| { bottom: number; left: number };

ViewState
Current viewport state of the map.

type ViewState = {
center: LngLat;
zoom: number;
bearing: number;
pitch: number;
bounds: LngLatBounds;
};

ViewStateChangeEvent
Event emitted when the map viewport changes (pan, zoom, rotate, pitch).

type ViewStateChangeEvent = ViewState & {
animated: boolean;
userInteraction: boolean;
};

QueryRenderedFeaturesOptions
Options for querying rendered features at a screen point or within a bounding box.

type QueryRenderedFeaturesOptions = {
/\*\*
_ Filter expression to filter the queried features
_/
filter?: FilterSpecification;

     /**
      * IDs of layers to query features from
      */
     layers?: string[];

};
Camera
Controls the viewport of the Map.

Props
testID
Type: string

Required: No

zoom
The zoom level of the map.

Type: number

Required: No

bearing
The bearing (rotation) of the map.

Type: number

Required: No

pitch
The pitch of the map.

Type: number

Required: No

padding
The viewport padding in points.

Type: ViewPadding

Required: No

duration
The duration the map takes to animate to a new configuration.

Type: number

Required: No

easing
The easing or path the camera uses to animate to a new configuration.

Type: CameraEasing

Required: No

initialViewState
Default view settings applied on camera

Type: InitialViewState

Required: No

minZoom
Minimum zoom level of the map

Type: number

Required: No

maxZoom
Maximum zoom level of the map

Type: number

Required: No

maxBounds
Restrict map panning so that the center is within these bounds

Type: LngLatBounds

Required: No

trackUserLocation
The mode used to track the user location on the map:

undefined: The user's location is not tracked
"default": Centers the user's location
"heading": Centers the user's location and uses the compass for bearing
"course": Centers the user's location and uses the direction of travel for bearing
Type: TrackUserLocation

Required: No

Default: undefined

onTrackUserLocationChange
Triggered when trackUserLocation changes

Type:

(
event: NativeSyntheticEvent<TrackUserLocationChangeEvent>,
) => void

Required: No

ref
Ref to access Camera methods.

Type: Ref<CameraRef>

Required: No

Ref Methods
jumpTo(options)
Map camera will move to new coordinates at the same zoom level

options
Type: CameraCenterOptions & CameraOptions

Required: Yes

Jump to a position

cameraRef.current?.jumpTo({ center: [lng, lat] });

easeTo(options)
Map camera will move to new coordinates at the same zoom level

options
Type: CameraCenterOptions & CameraOptions & CameraAnimationOptions

Required: Yes

Eases camera to new location based on duration

cameraRef.current?.easeTo({ center: [lng, lat], duration: 200 });

flyTo(options)
Map camera will fly to new coordinate

options
Type: CameraCenterOptions & CameraOptions & CameraAnimationOptions

Required: Yes

cameraRef.current?.flyTo({ center: [lng, lat], duration: 12000 });

fitBounds(bounds, [options])
Map camera transitions to fit provided bounds

bounds
Type: LngLatBounds

Required: Yes

options
Type: CameraOptions & CameraAnimationOptions

Required: No

cameraRef.current?.fitBounds(
[west, south, east, north],
{ top: 20, right: 20, bottom: 20, left: 20 },
1000,
);

zoomTo(zoom, [options])
Map camera will zoom to specified level

zoom
Zoom level that the map camera will animate too

Type: number

Required: Yes

options
Options

Type: CameraOptions & CameraAnimationOptions

Required: No

cameraRef.current?.zoomTo(16, { duration: 100 });

setStop(stop)
Map camera will perform updates based on provided config. Advanced use only!

stop
Array of Camera stops

Type: CameraStop

Required: Yes

Returns: Promise<void>

cameraRef.current?.setStop({
centerCoordinate: [lng, lat],
zoomLevel: 16,
duration: 2000,
});

cameraRef.current?.setStop({
stops: [
{ pitch: 45, duration: 200 },
{ heading: 180, duration: 300 },
],
});

Types
CameraOptions
Camera viewport configuration: zoom, bearing, pitch, and padding.

interface CameraOptions {
zoom?: number;
bearing?: number;
pitch?: number;
padding?: ViewPadding;
}

CameraEasing
Easing function used for camera animations.

type CameraEasing = undefined | "linear" | "ease" | "fly";

CameraAnimationOptions
Animation timing options for camera transitions.

interface CameraAnimationOptions {
duration?: number;
easing?: CameraEasing;
}

CameraCenterOptions
Camera center coordinate options.

interface CameraCenterOptions {
center: LngLat;
}

CameraBoundsOptions
Camera bounds options.

interface CameraBoundsOptions {
bounds: LngLatBounds;
}

CameraCenterStop
Camera animation stop positioned by a center coordinate.

type CameraCenterStop = CameraOptions &
CameraAnimationOptions &
CameraCenterOptions;

CameraBoundsStop
Camera animation stop positioned by geographic bounds.

type CameraBoundsStop = CameraOptions &
CameraAnimationOptions &
CameraBoundsOptions;

CameraStop
A single camera animation stop — optionally positioned by center, bounds, or neither.

type CameraStop =
| (CameraOptions &
CameraAnimationOptions & {
center?: never;
bounds?: never;
})
| CameraCenterStop
| CameraBoundsStop;

InitialViewState
Initial camera state when the map first loads.

type InitialViewState =
| (CameraOptions & {
center?: never;
bounds?: never;
})
| (CameraOptions & CameraCenterOptions)
| (CameraOptions & CameraBoundsOptions);

TrackUserLocation
User location tracking mode.

type TrackUserLocation = "default" | "heading" | "course";

TrackUserLocationChangeEvent
Event emitted when the user location tracking mode changes.

type TrackUserLocationChangeEvent = {
trackUserLocation: TrackUserLocation | null;
};
GeoJSONSource
GeoJSONSource is a map content source that supplies GeoJSON to be shown on the map. The data may be provided as an url or
a GeoJSON object.

Props
id
A string that uniquely identifies the source.

Type: string

Required: No

data
Can be provided as one of:

An HTTP(S) URL, absolute file URL, or local file URL relative to the current application’s resource bundle
Any valid GeoJSON object
Type: string | GeoJSON.GeoJSON

Required: Yes

cluster
Enables clustering on the source

Type: boolean

Required: No

clusterRadius
Specifies the radius of each cluster if clustering is enabled. A value of 512 produces a radius equal to the width of a
tile. The default value is 50.

Type: number

Required: No

clusterMinPoints
Specifies minimum number of points to form a cluster if clustering is enabled. The default value is 2.

Type: number

Required: No

clusterMaxZoom
Specifies the maximum zoom level at which to cluster points if clustering is enabled. Defaults to one zoom level less than
the value of maxzoom so that, at the maximum zoom, the data is not clustered.

Type: number

Required: No

clusterProperties
Specifies custom properties on the generated clusters if clustering is enabled, aggregating values from clustered points.
Has the form { "property_name": [operator, map_expression]} , where operator is a custom reduce expression that references
a special ["accumulated"] value - it accumulates the property value from clusters/points the cluster contains
map_expression produces the value of a single point

Type: GeoJSONSourceSpecification["clusterProperties"]

Required: No

maxzoom
Specifies the maximum zoom level at which to create vector tiles. A greater value produces greater detail at high zoom
levels. The default value is 18.

Type: number

Required: No

buffer
Specifies the size of the tile buffer on each side. A value of 0 produces no buffer. A value of 512 produces a buffer as
wide as the tile itself. Larger values produce fewer rendering artifacts near tile edges and slower performance. The
default value is 128.

Type: number

Required: No

tolerance
Douglas-Peucker simplification tolerance applied to geometries Higher means simpler geometries and faster performance.

Type: number

Required: No

Default: 0.375

lineMetrics
Whether to calculate line distance metrics. This is required for line layers that specify lineGradient values. The default
value is false.

Type: boolean

Required: No

children
Type: ReactNode

Required: No

ref
Ref to access GeoJSONSource methods.

Type: Ref<GeoJSONSourceRef>

Required: No

testID
Type: string

Required: No

onPress
Emits on press when a child Layer within the hitbox has highest z-index This bubbles up to Map's onPress unless
event.stopPropagation() is called.

Type: (event: NativeSyntheticEvent<PressEventWithFeatures>) => void

Required: No

hitbox
Overrides the default touch hitbox (44 x 44 pixels) for the source layers

Type: ViewPadding

Required: No

Ref Methods
getData([filter])
Get all features from the source that match the filter, regardless of visibility

filter
Optional filter statement to filter the returned features

Type: FilterSpecification

Required: No

Returns: Promise<GeoJSON.FeatureCollection>

const data = await geoJSONSourceRef.current?.getData(clusterId);

getClusterExpansionZoom(clusterId)
Returns the zoom needed to expand the cluster.

clusterId
The feature cluster to expand.

Type: number

Required: Yes

Returns: Promise<number> — Zoom level at which the cluster expands

const zoom = await geoJSONSourceRef.current?.getClusterExpansionZoom(clusterId);

getClusterLeaves(clusterId, limit, offset)
Returns the FeatureCollection from the cluster.

clusterId
The feature cluster to expand.

Type: number

Required: Yes

limit
The number of points to return.

Type: number

Required: Yes

offset
The amount of points to skip (for pagination).

Type: number

Required: Yes

Returns: Promise<GeoJSON.Feature[]>

const collection = await geoJSONSourceRef.current?.getClusterLeaves(clusterId, limit, offset);

getClusterChildren(clusterId)
Returns the FeatureCollection from the cluster (on the next zoom level).

clusterId
The feature cluster to expand.

Type: number

Required: Yes

Returns: Promise<GeoJSON.Feature[]>

const collection = await geoJSONSourceRef.current?.getClusterChildren(clusterId);

getAnimatableRef()
Returns the native ref for Reanimated compatibility.

Returns: NativeGeoJSONSourceRef | null
ImageSource
ImageSource is a content source that is used for a georeferenced raster image to be shown on the map. The georeferenced
image scales and rotates as the user zooms and rotates the map

Props
id
A string that uniquely identifies the source.

Type: string

Required: No

url
An HTTP(S) URL, absolute file URL, or local file URL to the source image. Animated GIFs are not supported.

Type: string | number

Required: Yes

coordinates
The top left, top right, bottom right, and bottom left coordinates for the image.

Type:

[
topLeft: LngLat,
topRight: LngLat,
bottomRight: LngLat,
bottomLeft: LngLat,
]

Required: Yes

children
Type: ReactNode

Required: No

testID
Type: string

Required: No
RasterDEMSource
RasterDEMSource is a map content source that supplies rasterized digital elevation model (DEM) tiles to be shown on the
map. Use it together with a hillshade layer to visualize terrain.

Props
id
A string that uniquely identifies the source.

Type: string

Required: No

url
A URL to a TileJSON configuration file describing the source's contents and other metadata.

Type: string

Required: No

tiles
An array of tile URL templates. If multiple endpoints are specified, clients may use any combination of endpoints.

Type: string[]

Required: No

minzoom
An unsigned integer that specifies the minimum zoom level at which to display tiles from the source. The value should be
between 0 and 22, inclusive, and less than maxzoom, if specified. The default value for this option is 0.

Type: number

Required: No

maxzoom
An unsigned integer that specifies the maximum zoom level at which to display tiles from the source. The value should be
between 0 and 22, inclusive, and greater than minzoom, if specified. The default value for this option is 22.

Type: number

Required: No

tileSize
Size of the map tiles.

Type: number

Required: No

Default: 512

attribution
An HTML or literal text string defining the buttons to be displayed in an action sheet when the source is part of a map
view's style and the map view's attribution button is pressed.

Type: string

Required: No

encoding
The encoding formula for the raster DEM tileset.

Type: "mapbox" | "terrarium"

Required: No

Default: "mapbox"

children
Type: ReactNode

Required: No

testID
Type: string

Required: No
RasterSource
RasterSource is a map content source that supplies raster image tiles to be shown on the map. The location of and metadata
about the tiles are defined either by an option dictionary or by an external file that conforms to the TileJSON
specification.

Props
id
A string that uniquely identifies the source.

Type: string

Required: No

url
A URL to a TileJSON configuration file describing the source's contents and other metadata.

Type: string

Required: No

tiles
An array of tile URL templates. If multiple endpoints are specified, clients may use any combination of endpoints.

Type: string[]

Required: No

minzoom
An unsigned integer that specifies the minimum zoom level at which to display tiles from the source. The value should be
between 0 and 22, inclusive, and less than maxzoom, if specified. The default value for this option is 0.

Type: number

Required: No

maxzoom
An unsigned integer that specifies the maximum zoom level at which to display tiles from the source. The value should be
between 0 and 22, inclusive, and less than minzoom, if specified. The default value for this option is 22.

Type: number

Required: No

tileSize
Size of the map tiles.

Type: number

Required: No

Default: 512

scheme
Influences the y direction of the tile coordinates. (tms inverts y-axis)

Type: "xyz" | "tms"

Required: No

Default: "xyz"

attribution
An HTML or literal text string defining the buttons to be displayed in an action sheet when the source is part of a map
view's style and the map view's attribution button is pressed.

Type: string

Required: No

children
Type: ReactNode

Required: No

testID
Type: string

Required: No
VectorSource
VectorSource is a map content source that supplies tiled vector data in Mapbox Vector Tile format to be shown on the map.
The location of and metadata about the tiles are defined either by an option dictionary or by an external file that
conforms to the TileJSON specification.

Props
id
A string that uniquely identifies the source.

Type: string

Required: No

url
A URL to a TileJSON configuration file describing the source’s contents and other metadata.

Type: string

Required: No

tiles
An array of tile URL templates. If multiple endpoints are specified, clients may use any combination of endpoints. Common
format should be: https://example.com/vector-tiles/{z}/{x}/{y}.pbf .

Type: string[]

Required: No

minzoom
An unsigned integer that specifies the minimum zoom level at which to display tiles from the source. The value should be
between 0 and 22, inclusive, and less than maxzoom, if specified. The default value for this option is 0.

Type: number

Required: No

maxzoom
An unsigned integer that specifies the maximum zoom level at which to display tiles from the source. The value should be
between 0 and 22, inclusive, and less than minzoom, if specified. The default value for this option is 22.

Type: number

Required: No

scheme
Influences the y direction of the tile coordinates. (tms inverts y-axis)

Type: "xyz" | "tms"

Required: No

Default: "xyz"

attribution
An HTML or literal text string defining the buttons to be displayed in an action sheet when the source is part of a map
view’s style and the map view’s attribution button is pressed.

Type: string

Required: No

children
Type: ReactNode

Required: No

ref
Ref to access VectorSource methods.

Type: Ref<VectorSourceRef>

Required: No

testID
Type: string

Required: No

onPress
Emits on press when a child Layer within the hitbox has highest z-index This bubbles up to Map's onPress unless
event.stopPropagation() is called.

Type: (event: NativeSyntheticEvent<PressEventWithFeatures>) => void

Required: No

hitbox
Overrides the default touch hitbox (44 x 44 pixels) for the source layers

Type: ViewPadding

Required: No

Ref Methods
querySourceFeatures(options)
Returns all features that match the query parameters regardless of whether the feature is currently rendered on the map.
The domain of the query includes all currently-loaded vector tiles and GeoJSON source tiles. This function does not check
tiles outside the visible viewport.

options
Type:

{
sourceLayer: string;
filter?: FilterSpecification;
}

Required: Yes

Returns: Promise<GeoJSON.Feature[]>

vectorSource.querySourceFeatures({ sourceLayer: "some-source-layer" });
Layer
Layer is a style layer that renders geospatial data on the map. Follow the MapLibre Style Spec for Layer definitions.

Basic Usage

<Layer
type="fill"
id="parks"
source="parks-source"
paint={{ "fill-color": "green", "fill-opacity": 0.5 }}
layout={{ visibility: "visible" }}
/>

Using Expressions

<Layer
type="fill"
id="parks"
source="parks-source"
paint={{
       "fill-color": [
         "interpolate",
         ["linear"],
         ["get", "elevation"],
         0,
         "blue",
         100,
         "red",
       ],
     }}
/>

Props
source
Type: string

Required: No

source-layer
Type: string

Required: No

filter
Type: FilterSpecification

Required: No

id
A string that uniquely identifies the layer in the style.

Type: string

Required: No

minzoom
The minimum zoom at which the layer gets parsed and appears.

Type: number

Required: No

maxzoom
The maximum zoom at which the layer gets parsed and appears.

Type: number

Required: No

paint
Type: never

Required: No

layout
Type: never

Required: No

beforeId
The layer will appear under this layer.

Type: string

Required: No

afterId
The layer will appear above this layer.

Type: string

Required: No

layerIndex
Inserts the layer at the specified index.

Type: number

Required: No

testID
Type: string

Required: No

Images
Images defines the images used in Symbol layers. Use this component to add images to the map style that can be referenced
by symbol layers using the iconImage property.

Props
images
Specifies the images in key-value pairs required for the style. Keys are names used in style expressions (e.g.,
"customIcon"). Values provide a source, which can be one of the following types:

A string URL: "https://example.com/icon.png"
A native asset name: "pin" (from xcassets on iOS or drawable on Android)
A require/import: require('./icon.png') If your image supports SDF, you can set the sdf property to true: { source:
require('./sdf-icon.png'), sdf: true }
Type: { [key: string]: ImageEntry }

Required: Yes

onImageMissing
Called when a layer references an image that is not present in the style. You can use this to dynamically add images on
demand.

Type: (event: NativeSyntheticEvent<{ image: string }>) => void

Required: No

testID
Type: string

Required: No

Types
ImageSourceWithSdf
An image source with optional SDF (Signed Distance Field) rendering mode.

type ImageSourceWithSdf = {
source: ImageSourcePropType;
sdf?: boolean;
};

ImageEntry
A map image entry: a URL string, a native asset require, or an ImageSourceWithSdf object.

type ImageEntry = string | ImageRequireSource | ImageSourceWithSdf;
Callout
Callout that displays information about a selected annotation near the annotation.

Also accepts props from: Omit<ViewProps, "style">

Props
title
String that gets displayed in the default callout.

Type: string

Required: No

style
Style property for the CalloutNativeComponent. Use at your own risk.

Type: ViewStyle

Required: No

animatedStyle
Style property for the Animated.View wrapper, apply animations to this

Type: ViewStyle

Required: No

contentStyle
Style property for the content bubble.

Type: ViewStyle

Required: No

tipStyle
Style property for the triangle tip under the content.

Type: ViewStyle

Required: No

titleStyle
Style property for the title in the content bubble.

Type: ViewStyle

Required: No

LayerAnnotation
Convenience wrapper around a GeoJSONSource for a Point/LngLat, optionally animated.

Props
id
Type: string

Required: No

lngLat
Type: LngLat

Required: Yes

animated
Type: boolean

Required: No

animationDuration
Type: number

Required: No

animationEasingFunction
Type: (x: number) => number

Required: No

onPress
Type: (event: NativeSyntheticEvent<PressEventWithFeatures>) => void

Required: No

children
Type: ReactNode

Required: No

testID
Type: string

Required: No

Marker
Marker allows you to place an interactive React Native View on the map. If you have static view consider using
ViewAnnotation or SymbolLayer for better performance. Implemented through:

Android: Native Views placed on the map projection
iOS: MLNPointAnnotation
Also accepts props from: ViewProps

Props
id
A string that uniquely identifies the marker.

Type: string

Required: No

lngLat
The center point (specified as a map coordinate) of the marker. See also #anchor.

Type: LngLat

Required: Yes

anchor
Specifies the anchor being set on a particular point of the annotation. The anchor indicates which part of the marker
should be placed closest to the coordinate.

Type: Anchor

Required: No

Default: "center"

See also: https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PositionAnchor/

offset
The offset in pixels to apply relative to the anchor. Negative values indicate left and up.

Type: PixelPoint

Required: No

Default: [0, 0]

See also: https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerOptions/#offset

selected
Manually selects/deselects the marker. iOS

Type: boolean

Required: No

onPress
This callback is fired when the marker is pressed.

Type: (event: NativeSyntheticEvent<MarkerEvent>) => void

Required: No

children
Expects one child - can be a View with multiple elements.

Type: ReactElement

Required: Yes

ref
Ref to access Marker methods.

Type: Ref<MarkerRef>

Required: No

Ref Methods
getAnimatableRef()
Returns the native ref for Reanimated v4 compatibility.

Returns: NativeMarkerRef | null

Types
MarkerEvent
Event emitted by a Marker on press.

type MarkerEvent = PressEvent & {
id: string;
};

UserLocation
Props
children
Children to render inside the UserLocation Annotation, e.g. CircleLayer, SymbolLayer

Type: ReactNode

Required: No

animated
Whether the UserLocation Annotation is animated between updates

Type: boolean

Required: No

accuracy
Render a circle which indicates the accuracy of the location

Type: boolean

Required: No

heading
Render an arrow which indicates direction the device is pointing relative to north

Type: boolean

Required: No

minDisplacement
Minimum delta in meters for location updates

Type: number

Required: No

onPress
Event triggered on pressing the UserLocation Annotation

Type: () => void

Required: No

ViewAnnotation
ViewAnnotation represents a one-dimensional shape located at a single geographical coordinate. Consider using
GeoJSONSource and SymbolLayer instead, if you have many points, and you have static images, they'll offer much better
performance. If you need interactive views please use Marker, as with ViewAnnotation on Android child views are rendered
onto a bitmap for better performance.

Props
id
A string that uniquely identifies the annotation. If not provided, a unique ID will be generated automatically.

Type: string

Required: No

title
The string containing the annotation's title. Note this is required to be set if you want to see a callout appear on iOS.

Type: string

Required: No

snippet
The string containing the annotation's snippet(subtitle). Not displayed in the default callout.

Type: string

Required: No

selected
Manually selects/deselects annotation

Type: boolean

Required: No

draggable
Enable or disable dragging.

Type: boolean

Required: No

Default: false

lngLat
The center point (specified as a map coordinate) of the annotation.

Type: LngLat

Required: Yes

anchor
Specifies the anchor being set on a particular point of the annotation. The anchor indicates which part of the marker
should be placed closest to the coordinate.

Type: Anchor

Required: No

Default: "center"

See also: https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PositionAnchor/

offset
The offset in pixels to apply relative to the anchor. Negative values indicate left and up.

Type: PixelPoint

Required: No

Default: [0, 0]

See also: https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerOptions/#offset

onPress
This callback is fired when the annotation is pressed.

Type: (event: NativeSyntheticEvent<ViewAnnotationEvent>) => void

Required: No

onSelect
This callback is fired once this annotation is selected.

Type: (event: NativeSyntheticEvent<ViewAnnotationEvent>) => void

Required: No

onDeselect
This callback is fired once this annotation is deselected.

Type: (event: NativeSyntheticEvent<ViewAnnotationEvent>) => void

Required: No

onDragStart
This callback is fired once this annotation has started being dragged.

Type: (event: NativeSyntheticEvent<ViewAnnotationEvent>) => void

Required: No

onDragEnd
This callback is fired once this annotation has stopped being dragged.

Type: (event: NativeSyntheticEvent<ViewAnnotationEvent>) => void

Required: No

onDrag
This callback is fired while this annotation is being dragged.

Type: (event: NativeSyntheticEvent<ViewAnnotationEvent>) => void

Required: No

style
Type: ViewProps["style"]

Required: No

children
Expects one child, and an optional callout can be added as well

Type: ReactElement | [ReactElement, ReactElement]

Required: Yes

ref
Ref to access ViewAnnotation methods.

Type: Ref<ViewAnnotationRef>

Required: No

Ref Methods
refresh()
On android point annotation is rendered offscreen with a canvas into an image. To rerender the image from the current
state of the view call refresh. Call this for example from Image#onLoad.

getAnimatableRef()
Returns the native ref for Reanimated v4 compatibility.

Returns: NativeViewAnnotationRef | null

Types
ViewAnnotationEvent
Event emitted by a ViewAnnotation on press.

type ViewAnnotationEvent = PressEvent & {
id: string;
};

LocationManager
Methods
getCurrentPosition()
Returns: Promise<GeolocationPosition | undefined>

addListener(newListener)
newListener
Type: (location: GeolocationPosition) => void

Required: Yes

removeListener(oldListener)
oldListener
Type: (location: GeolocationPosition) => void

Required: Yes

removeAllListeners()
start()
stop()
setMinDisplacement(minDisplacement)
minDisplacement
Type: number

Required: Yes

requestPermissions()
Request location permissions Requests the following:

Android: ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION
iOS: requestWhenInUseAuthorization
Returns: Promise<boolean> — Promise resolves to true if permissions were granted, false otherwise
LogManager
Methods
onLog(logHandler)
Override logging behavior

logHandler
Type: LogHandler

Required: Yes

setLogLevel(level)
Set the minimum log level for a message to be logged

level
Minimum log level

Type: LogLevel

Required: Yes

start()
stop()
Types
LogLevel
Log levels in decreasing order of severity

type LogLevel = "error" | "warn" | "info" | "debug" | "verbose";

NetworkManager
NetworkManager provides methods for managing and controlling network connectivity.

Methods
setConnected(connected)
Android only: Sets the connectivity state of the map. When set to false, the map will not make any network requests and
will only use cached tiles. This is useful for implementing offline mode or reducing data usage.

connected
Whether the map should be connected to the network

Type: boolean

Required: Yes

// Enable offline mode
NetworkManager.setConnected(false);
// Re-enable network requests
NetworkManager.setConnected(true);
OfflineManager
OfflineManager implements a singleton (shared object) that manages offline packs. All of this class's instance methods are
asynchronous, reflecting the fact that offline resources are stored in a database. The shared object maintains a canonical
collection of offline packs.

Methods
createPack(options, progressListener, errorListener)
Creates and registers an offline pack that downloads the resources needed to use the given region offline.

options
Create options for offline pack that specifies zoom levels, style url, and the region to download.

Type: OfflinePackCreateOptions

Required: Yes

progressListener
Callback that listens for status events while downloading the offline resource.

Type: OfflinePackProgressListener

Required: Yes

errorListener
Callback that listens for status events while downloading the offline resource.

Type: OfflinePackErrorListener

Required: Yes

Returns: Promise<OfflinePack> — The created offline pack with its generated ID.

const progressListener = (offlineRegion, status) =>
console.log(offlineRegion, status);
const errorListener = (offlineRegion, error) =>
console.log(offlineRegion, error);

const offlinePack = await OfflineManager.createPack(
{
mapStyle: "https://demotiles.maplibre.org/tiles/tiles.json",
minZoom: 14,
maxZoom: 20,
bounds: [west, south, east, north],
metadata: { customValue: "myValue" },
},
progressListener,
errorListener,
);

invalidatePack(id)
Invalidates the specified offline pack. This method checks that the tiles in the specified offline pack match those from
the server. Local tiles that do not match the latest version on the server are updated. This is more efficient than
deleting the offline pack and downloading it again. If the data stored locally matches that on the server, new data will
not be downloaded.

id
ID of the OfflinePack.

Type: string

Required: Yes

Returns: Promise<void>

await OfflineManager.invalidatePack(pack.id);

deletePack(id)
Unregisters the given OfflinePack and allows resources that are no longer required by any remaining packs to be
potentially freed.

id
ID of the OfflinePack.

Type: string

Required: Yes

Returns: Promise<void>

await OfflineManager.deletePack(pack.id);

invalidateAmbientCache()
Forces a revalidation of the tiles in the ambient cache and downloads a fresh version of the tiles from the tile server.
This is the recommend method for clearing the cache. This is the most efficient method because tiles in the ambient cache
are re-downloaded to remove outdated data from a device. It does not erase resources from the ambient cache or delete the
database, which can be computationally expensive operations that may carry unintended side effects.

Returns: Promise<void>

await OfflineManager.invalidateAmbientCache();

clearAmbientCache()
Erases resources from the ambient cache. This method clears the cache and decreases the amount of space that map resources
take up on the device.

Returns: Promise<void>

await OfflineManager.clearAmbientCache();

setMaximumAmbientCacheSize(size)
Sets the maximum size of the ambient cache in bytes. Disables the ambient cache if set to 0. This method may be
computationally expensive because it will erase resources from the ambient cache if its size is decreased.

size
Size of ambient cache.

Type: number

Required: Yes

Returns: Promise<void>

await OfflineManager.setMaximumAmbientCacheSize(5000000);

resetDatabase()
Deletes the existing database, which includes both the ambient cache and offline packs, then reinitializes it.

Returns: Promise<void>

await OfflineManager.resetDatabase();

getPacks()
Retrieves all the current offline packs that are stored in the database.

Returns: Promise<OfflinePack[]>

const offlinePacks = await OfflineManager.getPacks();

getPack(id)
Retrieves an offline pack that is stored in the database by ID.

id
Type: string

Required: Yes

Returns: Promise<OfflinePack>

const offlinePack = await OfflineManager.getPack(offlinePack.id);

mergeOfflineRegions(path)
Sideloads offline db

path
Path to offline tile db on file system.

Type: string

Required: Yes

Returns: Promise<void>

await OfflineManager.mergeOfflineRegions(path);

setTileCountLimit(limit)
Sets the maximum number of tiles that may be downloaded and stored on the current device. Consult the Terms of Service for
your map tile host before changing this value.

limit
Map tile limit count.

Type: number

Required: Yes

OfflineManager.setTileCountLimit(1000);

setProgressEventThrottle(throttleValue)
Sets the period at which download status events will be sent over the React Native bridge. The default is 500ms.

throttleValue
Event throttle value in ms.

Type: number

Required: Yes

OfflineManager.setProgressEventThrottle(500);

addListener(id, progressListener, errorListener)
Subscribe to download status/error events for the requested offline pack. Note that createPack calls this internally if
listeners are provided.

id
ID of the offline pack.

Type: string

Required: Yes

progressListener
Callback that listens for status events while downloading the offline resource.

Type: OfflinePackProgressListener

Required: Yes

errorListener
Callback that listens for status events while downloading the offline resource.

Type: OfflinePackErrorListener

Required: Yes

Returns: Promise<void>

const progressListener = (offlinePack, status) =>
console.log(offlinePack, status);
const errorListener = (offlinePack, error) => console.log(offlinePack, error);
OfflineManager.addListener(pack.id, progressListener, errorListener);

removeListener(packId)
Unsubscribes any listeners associated with the offline pack. Should be called when the component unmounts.

packId
ID of the offline pack.

Type: string

Required: Yes

useEffect(() => {
return () => {
OfflineManager.removeListener(pack.id);
};
}, []);

Types
OfflinePackDownloadState
Represents the offline pack download state

type OfflinePackDownloadState = "inactive" | "active" | "complete";
OfflinePack
Methods
status()
Returns: Promise<OfflinePackStatus>

resume()
Returns: Promise<void>

pause()
Returns: Promise<void>
StaticMapManager
The StaticMapManager creates static images of a map.

Methods
createImage(options)
Creates a static image of a map. Images are always in PNG format.

options
Type: StaticMapCreateOptions

Required: Yes

Returns: Promise<string>

Create static map with center, returning the URI to the temporary PNG file

const uri = await StaticMapManager.createImage({
center: [-74.12641, 40.797968],
zoom: 12,
bearing: 20,
pitch: 30,
mapStyle: "https://demotiles.maplibre.org/style.json",
width: 128,
height: 64,
output: "file",
});

Create a static map with bounds, returning a base64 encoded PNG

const uri = await StaticMapManager.createImage({
bounds: [
[-74.12641, 40.797968],
[-74.143727, 40.772177],
],
mapStyle: "https://demotiles.maplibre.org/style.json",
width: 128,
height: 64,
output: "base64",
});
TransformRequestManager
TransformRequestManager provides methods for managing HTTP requests made by MapLibre. Transformations are possible in
three ways:

Transforming the URL with search and replace
Adding URL search params
Adding HTTP headers Transforms are applied in this order. The match conditions are applied to possibly already transformed
URLs. To gain insight into which transforms are applied set the log level to "debug" via LogManager:
LogManager.setLogLevel("debug");

Methods
addUrlTransform(options)
Adds or updates a URL transform identified by id. Transforms execute in insertion order. Therefore match and find regexes
are matched against possibly already modified URL by previous transforms. Re-adding an existing id updates the transform
in-place, preserving its position in the pipeline. This makes it safe to refresh tokens or swap domains without disrupting
the order of other transforms. URL transforms are applied before addUrlSearchParam and addHeader.

options
The transform. Set TransformOptions to a stable string to enable in-place updates; if omitted an id is auto-generated and
returned.

Type: UrlTransformOptions

Required: Yes

Returns: string — The id of the transform (the value of transform.id when provided, otherwise the auto-generated one).
Pass it to removeUrlTransform to remove it later.

Upgrade all requests to HTTPS

TransformRequestManager.addUrlTransform({
id: "force-https",
find: "^http://",
replace: "https://",
});

Redirect a specific domain through a proxy

TransformRequestManager.addUrlTransform({
id: "proxy",
match: "tiles\\.example\\.com",
find: "tiles\\.example\\.com",
replace: "proxy.example.com",
});

Inject an API key into the path using a capture group

TransformRequestManager.addUrlTransform({
id: "api-key",
match: "api\\.example\\.com",
find: "(https://api\\.example\\.com/)(.\*)",
replace: "$1mySecretKey/$2",
});

removeUrlTransform(id)
Removes the URL transform with the given id . No-op if the id is not registered.

id
The identifier passed to/returned from addUrlTransform.

Type: string

Required: Yes

clearUrlTransforms()
Removes all registered URL transforms

addUrlSearchParam(options)
Adds or updates a URL query parameter identified by id that will be appended to all matching map resource requests.
Re-adding an existing id updates the param in-place.

options
The options. Set TransformOptions to a stable string to enable in-place updates; if omitted an id is auto-generated and
returned.

Type: UrlSearchParamOptions

Required: Yes

Returns: string — The id of the options. Pass it to removeUrlSearchParam to remove it later.

Add apiKey to for a specific domain

TransformRequestManager.addUrlSearchParam({
match: /tiles\.example\.com/,
name: "apiKey",
value: "your-api-key",
});

Add apiKey to all requests (no match = applies to all)

TransformRequestManager.addUrlSearchParam({
name: "apiKey",
value: "your-api-key",
});

removeUrlSearchParam(id)
Removes a previously added URL query parameter by its id.

id
The identifier passed to/returned from addUrlSearchParam.

Type: string

Required: Yes

addHeader(options)
Adds or updates an HTTP header identified by id that will be sent with all matching map resource requests. Re-adding an
existing id updates the header in-place.

options
The options. Set TransformOptions to a stable string to enable in-place updates; if omitted an id is auto-generated and
returned.

Type: HeaderOptions

Required: Yes

Returns: string — The id of the options. Pass it to removeHeader to remove it later.

Add header to all requests

TransformRequestManager.addHeader({ name: "Authorization", value: "Bearer token123" });

Add header only to requests matching a pattern

TransformRequestManager.addHeader({
name: "X-API-Key",
value: "key123",
match: /https:\/\/api\.example\.com\/tiles\//,
});

clearUrlSearchParams()
Removes all registered URL search params.

removeHeader(id)
Removes a previously added HTTP header by its id.

id
The identifier passed to/returned from addHeader.

Type: string

Required: Yes

clearHeaders()
Removes all registered HTTP headers.

clear()
Removes all registered URL transforms, URL search params and HTTP headers.

Types
UrlTransformOptions
A serializable transform for rewriting MapLibre request URLs. Transforms are applied as a pipeline in the order they were
added: transform N+1 sees the URL after transform N has possibly changed it.

interface UrlTransformOptions {
find: RegExp | string;
replace: string;
}

UrlSearchParamOptions
A URL query parameter to append to matching map resource requests.

interface UrlSearchParamOptions {
name: string;
value: string;
}

HeaderOptions
A HTTP header to send with matching map resource requests.

interface HeaderOptions {
name: string;
value: string;
}
Anchor
Position anchor for markers and annotations. Follows MapLibre GL JS PositionAnchor format.

Type
| "center"
| "top"
| "bottom"
| "left"
| "right"
| "top-left"
| "top-right"
| "bottom-left"
| "bottom-right"
BaseProps
Base props supported by all components.

Type
{
testID?: string;
}
LngLatBounds
Represents bounds in geographic coordinates Uses order of south-west and north-east corners in flat style per GeoJSON RFC.

Type
[
west: number,
south: number,
east: number,
north: number,
]

LngLat
Geographic coordinates

Type
[longitude: number, latitude: number]
PixelPointBounds
Bounds in pixel coordinates Uses common order of top-left and bottom-right corners.

Type
[
topLeft: [left: number, top: number],
bottomRight: [right: number, bottom: number],
]
PixelPoint
Pixel coordinates

Type
[x: number, y: number]
PressEventWithFeatures
Press event data enriched with GeoJSON features at the pressed location.

Type
interface PressEventWithFeatures extends PressEvent {
features: GeoJSON.Feature[];
}
PressEvent
Event data for map press interactions.

Type
{
lngLat: LngLat;
point: PixelPoint;
}
PressableSourceProps
Props shared by source components that support press interactions.

Type
{
onPress?: (event: NativeSyntheticEvent<PressEventWithFeatures>) => void;
hitbox?: ViewPadding;
}
ViewPadding
Pixel insets used for view padding.

Type
{
top?: number;
right?: number;
bottom?: number;
left?: number;
}
