import type { LitElement } from 'lit';
import {
  POP_ON,
  canAnimate,
  clamp,
  num,
  prefersReducedMotion,
  squish,
  squishTune,
} from '../internal/choice-motion.js';
import type { PrismRadio } from './radio.js';
import { Press } from '../internal/press.js';
import {
  SpringMotion,
  type Pose,
  type Tune,
} from '../internal/spring-motion.js';

/*
 * Motion model. A pose of three numbers on springs, drawn by one pure
 * function (the same clock for all layers):
 *   q  squish: 0 at rest, 1 held down.
 *   r  ring: 0 plain edge, 1 accent ring.
 *   d  dot: its scale; past 1 is the overshoot as it springs in.
 * The dot that is leaving shrinks on a critical spring (no bounce), while the
 * one arriving grows with a gentle overshoot, started in the same frame.
 */
type Key = 'q' | 'r' | 'd';
type Layer = 'box' | 'ring' | 'dot';

const DOT_IN: Tune = { w: 26, z: 0.55 };
const DOT_OUT: Tune = { w: 30, z: 1 };
const RING: Tune = { w: 30, z: 1 };

function draw(pose: Pose<Key>): Record<Layer, Keyframe> {
  const dot = Math.max(0, pose.d);
  return {
    box: squish(pose.q),
    ring: { opacity: num(clamp(pose.r)) },
    dot: {
      transform: `scale(${num(dot)})`,
      opacity: num(clamp(dot * 4)),
    },
  };
}

/**
 * Private. The press and spring motion of one radio in a group. The group
 * draws every radio's input and box in its own shadow root (native radios
 * only share a name inside one root), so each radio's motion lives here.
 */
export class RadioOption {
  /** The option's wrapper in the group's shadow root. */
  root?: Element;
  readonly press: Press;
  readonly #motion: SpringMotion<Key, Layer>;
  #checked = false;
  /** False until the first render is on screen: nothing animates before it. */
  #ready = false;

  /** Passed to `ref()` on the option's wrapper. */
  readonly attachRoot = (el?: Element): void => {
    this.root = el;
  };

  /** Passed to `ref()` on the native input, so the radio can focus and click it. */
  readonly attachInput = (el?: Element): void => {
    this.radio.input = (el as HTMLInputElement | undefined) ?? null;
  };

  constructor(
    private readonly host: Pick<LitElement, 'requestUpdate'> & Element,
    private readonly radio: PrismRadio,
    private readonly isChecked: () => boolean,
    isDisabled: () => boolean,
  ) {
    this.press = new Press(
      host,
      () => !isDisabled() && !prefersReducedMotion(),
      () => this.#retarget(),
    );
    this.#motion = new SpringMotion<Key, Layer>(
      ['q', 'r', 'd'],
      {
        box: { el: () => this.#part('box') },
        ring: { el: () => this.#part('ring') },
        dot: { el: () => this.#part('dot') },
      },
      draw,
    );
  }

  /** The styles for the pose at rest, so a render matches where a move ends. */
  get rest(): Record<Layer, Keyframe> {
    return draw(this.#pose());
  }

  /** Call after each render: the first lands at rest, a later change moves. */
  settle(): void {
    const checked = this.isChecked();
    if (!this.#ready) {
      this.#ready = true;
      this.#motion.snap(this.#pose());
    } else if (checked !== this.#checked) {
      this.#retarget(checked ? POP_ON : 0);
    }
    this.#checked = checked;
  }

  /** Back on screen: sit at rest. */
  snap(): void {
    if (this.#ready) this.#motion.snap(this.#pose());
  }

  stop(): void {
    this.#motion.stop();
    this.press.clear();
  }

  #part(name: string): Element | null | undefined {
    return this.root?.querySelector(`[part~="${name}"]`);
  }

  #pose(): Pose<Key> {
    const on = this.isChecked() ? 1 : 0;
    return { q: this.press.held ? 1 : 0, r: on, d: on };
  }

  /** Moves to the current pose; `pop` is the extra push when it is picked. */
  #retarget(pop = 0): void {
    const pose = this.#pose();
    if (!this.#ready || !canAnimate(this.host, this.#part('box') ?? null))
      return this.#motion.snap(pose);
    this.#motion.go(pose, (key) => {
      if (key === 'q') return squishTune(pose.q > 0, pop);
      return key === 'r' ? RING : pose.d ? DOT_IN : DOT_OUT;
    });
  }
}
