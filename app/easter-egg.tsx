import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import * as React from 'react';
import { Animated, Easing, Image, Pressable, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Obstacle = {
  id: number;
  x: number;
  width: number;
  height: number;
  source: number;
};

const BEST_SCORE_KEY = 'ark.game.runner.best';
const GAME_HEIGHT = 270;
const GROUND_OFFSET = 34;
const PLAYER_WIDTH = 132;
const PLAYER_HEIGHT = 64;
const PLAYER_GROUND_SINK = 8;
const GRAVITY = 0.9;
const JUMP_VELOCITY = -13.5;
const START_SPEED = 7;
const MAX_SPEED = 16;
const FRAME_MS = 16;
const OBSTACLE_GAP_MIN = 320;
const OBSTACLE_GAP_MAX = 560;
const OBSTACLE_GROUND_SINK = 10;
const PLAYER_HITBOX = { left: 30, right: 22, top: 14, bottom: 10 };
const OBSTACLE_HITBOX = { left: 10, right: 10, top: 10, bottom: 8 };
const CLOUD_SPRITE = require('@/assets/images/arky/game_sprites/cloud.png');
const SUN_SPRITE = require('@/assets/images/arky/game_sprites/sun.png');
const SAND_FLOOR_SPRITE = require('@/assets/images/arky/game_sprites/sand_floor.png');
const CLOUD_NEAR_STRIDE = 280;
const CLOUD_FAR_STRIDE = 340;

const PLAYER_FRAMES = [
  require('@/assets/images/arky/game_sprites/starting_arky.png'),
  require('@/assets/images/arky/game_sprites/intermidiate_arky.png'),
  require('@/assets/images/arky/game_sprites/final_arky.png'),
] as const;

const OBSTACLE_SPRITES = [
  require('@/assets/images/arky/game_sprites/cactus.png'),
  require('@/assets/images/arky/game_sprites/rock.png'),
] as const;

function randomObstacle(gameWidth: number, id: number, offset = 0): Obstacle {
  const source = OBSTACLE_SPRITES[Math.floor(Math.random() * OBSTACLE_SPRITES.length)];
  const width = 38 + Math.floor(Math.random() * 20);
  const height = 36 + Math.floor(Math.random() * 28);
  return {
    id,
    source,
    width,
    height,
    x: gameWidth + offset,
  };
}

export default function EasterEggRunnerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const gameWidth = Math.max(320, width - 24);
  const stageHeight = isLandscape
    ? Math.max(220, Math.min(GAME_HEIGHT, height - 120))
    : Math.max(240, Math.min(350, Math.round(height * 0.38)));
  const playerX = 56;
  const groundY = stageHeight - GROUND_OFFSET;

  const [playerY, setPlayerY] = React.useState(0);
  const [obstacles, setObstacles] = React.useState<Obstacle[]>([]);
  const [running, setRunning] = React.useState(true);
  const [score, setScore] = React.useState(0);
  const [highScore, setHighScore] = React.useState(0);
  const [bestScore, setBestScore] = React.useState(0);
  const [frame, setFrame] = React.useState(0);
  const [cloudNearOffset, setCloudNearOffset] = React.useState(0);
  const [cloudFarOffset, setCloudFarOffset] = React.useState(0);
  const [sandOffset, setSandOffset] = React.useState(0);

  const nextObstacleRef = React.useRef(1);
  const sunRotation = React.useRef(new Animated.Value(0)).current;
  const runningRef = React.useRef(true);
  const playerYRef = React.useRef(0);
  const velocityRef = React.useRef(0);
  const scoreRef = React.useRef(0);
  const highScoreRef = React.useRef(0);
  const obstaclesRef = React.useRef<Obstacle[]>([]);

  const setupRun = React.useCallback(() => {
    nextObstacleRef.current = 1;
    runningRef.current = true;
    playerYRef.current = 0;
    velocityRef.current = 0;
    scoreRef.current = 0;
    highScoreRef.current = 0;
    const first = [randomObstacle(gameWidth, 0, 420)];
    obstaclesRef.current = first;

    setRunning(true);
    setPlayerY(0);
    setScore(0);
    setHighScore(0);
    setObstacles(first);
    setCloudNearOffset(0);
    setCloudFarOffset(0);
    setSandOffset(0);
  }, [gameWidth]);

  useFocusEffect(
    React.useCallback(() => {
      let orientationModule:
        | {
            lockAsync?: (orientationLock: number) => Promise<void>;
            unlockAsync?: () => Promise<void>;
            OrientationLock?: { LANDSCAPE: number };
          }
        | undefined;
      try {
        orientationModule = require('expo-screen-orientation');
        if (
          isLandscape &&
          orientationModule?.lockAsync &&
          orientationModule?.OrientationLock?.LANDSCAPE
        ) {
          void orientationModule.lockAsync(orientationModule.OrientationLock.LANDSCAPE);
        }
      } catch {
        orientationModule = undefined;
      }

      void SettingsRepository.get(BEST_SCORE_KEY).then((value) => {
        const parsed = Number(value ?? '0');
        setBestScore(Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0);
      });

      setupRun();

      return () => {
        if (orientationModule?.unlockAsync) {
          void orientationModule.unlockAsync();
        }
      };
    }, [isLandscape, setupRun])
  );

  React.useEffect(() => {
    setupRun();
  }, [setupRun]);

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sunRotation, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      sunRotation.setValue(0);
    };
  }, [sunRotation]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (!runningRef.current) return;

      setFrame((value) => (value + 1) % 18);

      velocityRef.current += GRAVITY;
      let nextY = playerYRef.current + velocityRef.current;
      if (nextY > 0) {
        nextY = 0;
        velocityRef.current = 0;
      }
      playerYRef.current = nextY;
      setPlayerY(nextY);

      scoreRef.current += 1;
      if (scoreRef.current > highScoreRef.current) {
        highScoreRef.current = scoreRef.current;
      }
      setScore(scoreRef.current);
      setHighScore(highScoreRef.current);

      const speed = Math.min(MAX_SPEED, START_SPEED + scoreRef.current / 350);
      const sandTileWidth = gameWidth + 140;
      setCloudNearOffset((value) => (value + speed * 0.46) % CLOUD_NEAR_STRIDE);
      setCloudFarOffset((value) => (value + speed * 0.26) % CLOUD_FAR_STRIDE);
      setSandOffset((value) => (value + speed * 0.95) % sandTileWidth);
      let moved = obstaclesRef.current
        .map((obstacle) => ({ ...obstacle, x: obstacle.x - speed }))
        .filter((obstacle) => obstacle.x + obstacle.width > -20);

      if (moved.length === 0) {
        moved = [randomObstacle(gameWidth, nextObstacleRef.current++, 160)];
      } else {
        const last = moved[moved.length - 1];
        const gap = OBSTACLE_GAP_MIN + Math.random() * (OBSTACLE_GAP_MAX - OBSTACLE_GAP_MIN);
        if (last.x < gameWidth - gap) {
          moved.push(randomObstacle(gameWidth, nextObstacleRef.current++, 0));
        }
      }

      const playerTop = groundY - PLAYER_HEIGHT + playerYRef.current + PLAYER_GROUND_SINK;
      const playerBottom = playerTop + PLAYER_HEIGHT - PLAYER_HITBOX.bottom;
      const playerRight = playerX + PLAYER_WIDTH - PLAYER_HITBOX.right;
      const playerLeft = playerX + PLAYER_HITBOX.left;
      const playerCollisionTop = playerTop + PLAYER_HITBOX.top;
      const collided = moved.some((obstacle) => {
        const obstacleLeft = obstacle.x + OBSTACLE_HITBOX.left;
        const obstacleRight = obstacle.x + obstacle.width - OBSTACLE_HITBOX.right;
        const obstacleTop = groundY - obstacle.height + OBSTACLE_GROUND_SINK + OBSTACLE_HITBOX.top;
        const obstacleBottom = groundY + OBSTACLE_GROUND_SINK - OBSTACLE_HITBOX.bottom;
        const overlapX = playerRight > obstacleLeft && playerLeft < obstacleRight;
        const overlapY = playerBottom > obstacleTop && playerCollisionTop < obstacleBottom;
        return overlapX && overlapY;
      });

      obstaclesRef.current = moved;
      setObstacles(moved);

      if (collided) {
        runningRef.current = false;
        setRunning(false);
      }
    }, FRAME_MS);

    return () => clearInterval(interval);
  }, [gameWidth, groundY, playerX]);

  React.useEffect(() => {
    if (running) return;
    if (highScoreRef.current <= bestScore) return;
    const nextBest = highScoreRef.current;
    setBestScore(nextBest);
    void SettingsRepository.set(BEST_SCORE_KEY, String(nextBest));
  }, [bestScore, running]);

  function jump() {
    if (!runningRef.current) return;
    if (playerYRef.current < -1) return;
    velocityRef.current = JUMP_VELOCITY;
  }

  const sunSize = isLandscape ? 82 : 68;
  const sunRotationStyle = {
    transform: [
      {
        rotate: sunRotation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  } as const;
  const sandTileWidth = gameWidth + 140;
  const sandHeight = Math.max(30, stageHeight - groundY + 14);

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={{ flex: 1, backgroundColor: '#020816' }}>
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          zIndex: 20,
          left: 12,
          right: 12,
          top: insets.top + 2,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Button size="icon" variant="ghost" onPress={() => router.replace('/(tabs)/chat')}>
          <Icon as={ArrowLeft} className="text-foreground size-5" />
        </Button>
        <View className="items-end">
          <Text className="text-primary text-xs uppercase">Highscore {highScore}</Text>
          <Text variant="small" className="text-muted-foreground">
            Best {bestScore}
          </Text>
        </View>
      </View>

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 12,
          paddingTop: insets.top + 50,
          paddingBottom: insets.bottom + 24,
        }}>
        <Pressable
          onPress={running ? jump : setupRun}
          style={{
            width: gameWidth,
            height: stageHeight,
            borderColor: '#2A3347',
            borderWidth: 1,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: '#0C2A5E',
          }}>
          <View className="absolute inset-0">
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: 'rgba(9, 28, 61, 0.28)',
              }}
            />
            <Animated.View
              style={[
                {
                  width: sunSize,
                  height: sunSize,
                  position: 'absolute',
                  right: 22,
                  top: 18,
                  opacity: 0.6,
                },
                sunRotationStyle,
              ]}>
              <Image
                source={SUN_SPRITE}
                style={{ width: sunSize, height: sunSize }}
                resizeMode="contain"
              />
            </Animated.View>
            <Image
              source={CLOUD_SPRITE}
              style={{
                width: 136,
                height: 70,
                opacity: 0.24,
                position: 'absolute',
                left: -120 - cloudFarOffset,
                top: 26,
              }}
              resizeMode="contain"
            />
            <Image
              source={CLOUD_SPRITE}
              style={{
                width: 136,
                height: 70,
                opacity: 0.24,
                position: 'absolute',
                left: -120 - cloudFarOffset + CLOUD_FAR_STRIDE,
                top: 42,
              }}
              resizeMode="contain"
            />
            <Image
              source={CLOUD_SPRITE}
              style={{
                width: 136,
                height: 70,
                opacity: 0.24,
                position: 'absolute',
                left: -120 - cloudFarOffset + CLOUD_FAR_STRIDE * 2,
                top: 28,
              }}
              resizeMode="contain"
            />
            <Image
              source={CLOUD_SPRITE}
              style={{
                width: 170,
                height: 86,
                opacity: 0.3,
                position: 'absolute',
                left: -120 - cloudNearOffset,
                top: 58,
              }}
              resizeMode="contain"
            />
            <Image
              source={CLOUD_SPRITE}
              style={{
                width: 170,
                height: 86,
                opacity: 0.3,
                position: 'absolute',
                left: -120 - cloudNearOffset + CLOUD_NEAR_STRIDE,
                top: 74,
              }}
              resizeMode="contain"
            />
            <Image
              source={CLOUD_SPRITE}
              style={{
                width: 170,
                height: 86,
                opacity: 0.3,
                position: 'absolute',
                left: -120 - cloudNearOffset + CLOUD_NEAR_STRIDE * 2,
                top: 58,
              }}
              resizeMode="contain"
            />
            <Image
              source={CLOUD_SPRITE}
              style={{
                width: 170,
                height: 86,
                opacity: 0.3,
                position: 'absolute',
                left: -120 - cloudNearOffset + CLOUD_NEAR_STRIDE * 3,
                top: 72,
              }}
              resizeMode="contain"
            />
          </View>

          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: groundY - 2,
              height: 2,
              backgroundColor: 'rgba(242, 184, 75, 0.78)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: Math.max(22, stageHeight - groundY),
              backgroundColor: '#0A2046',
            }}
          />
          <Image
            source={SAND_FLOOR_SPRITE}
            style={{
              width: sandTileWidth,
              height: sandHeight,
              position: 'absolute',
              left: -sandOffset,
              top: groundY - 1,
              opacity: 0.95,
            }}
            resizeMode="stretch"
          />
          <Image
            source={SAND_FLOOR_SPRITE}
            style={{
              width: sandTileWidth,
              height: sandHeight,
              position: 'absolute',
              left: -sandOffset + sandTileWidth - 1,
              top: groundY - 1,
              opacity: 0.95,
            }}
            resizeMode="stretch"
          />

          <Image
            source={PLAYER_FRAMES[Math.floor(frame / 6)]}
            style={{
              width: PLAYER_WIDTH,
              height: PLAYER_HEIGHT,
              position: 'absolute',
              left: playerX,
              top: groundY - PLAYER_HEIGHT + playerY + PLAYER_GROUND_SINK,
            }}
            resizeMode="contain"
          />

          {obstacles.map((obstacle) => (
            <Image
              key={obstacle.id}
              source={obstacle.source}
              style={{
                width: obstacle.width,
                height: obstacle.height,
                position: 'absolute',
                left: obstacle.x,
                top: groundY - obstacle.height + OBSTACLE_GROUND_SINK,
              }}
              resizeMode="contain"
            />
          ))}

          {running ? (
            <View className="absolute top-3 left-3 rounded-md bg-black/35 px-2 py-1">
              <Text className="text-sm text-[#E5E7EB]">{`Score: ${score}`}</Text>
            </View>
          ) : (
            <View className="absolute inset-0 items-center justify-center bg-black/25 px-6">
              <Text className="text-xl font-semibold text-[#F9FAFB]">{`Score: ${highScore}`}</Text>
              <Text className="mt-2 text-sm text-[#9CA3AF]">Tap to try again</Text>
            </View>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
