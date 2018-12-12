import { assert } from 'chai';
import { Machine } from '../src/Machine';

describe('deterministic machine', () => {
  const pedestrianStates = {
    initial: 'walk',
    states: {
      walk: {
        on: {
          PED_COUNTDOWN: 'wait',
          TIMER: undefined // forbidden event
        }
      },
      wait: {
        on: {
          PED_COUNTDOWN: 'stop',
          TIMER: undefined // forbidden event
        }
      },
      stop: {}
    }
  };

  const lightMachine = Machine({
    key: 'light',
    initial: 'green',
    states: {
      green: {
        on: {
          TIMER: 'yellow',
          POWER_OUTAGE: 'red'
        }
      },
      yellow: {
        on: {
          TIMER: 'red',
          POWER_OUTAGE: 'red'
        }
      },
      red: {
        on: {
          TIMER: 'green',
          POWER_OUTAGE: 'red'
        },
        ...pedestrianStates
      }
    }
  });

  const testMachine = Machine({
    key: 'test',
    initial: 'a',
    states: {
      a: {
        on: {
          T: 'b.b1',
          F: 'c'
        }
      },
      b: {
        initial: 'b1',
        states: {
          b1: {}
        }
      }
    }
  });

  const deepMachine = Machine({
    key: 'deep',
    initial: 'a',
    states: {
      a1: {
        initial: 'a2',
        states: {
          a2: {
            initial: 'a3',
            states: {
              a3: {
                initial: 'a4',
                states: {
                  a4: {}
                }
              }
            }
          }
        }
      }
    }
  });

  describe('machine.initialState', () => {
    it('should return the initial state value', () => {
      assert.deepEqual(lightMachine.initialState.value, 'green');
    });

    it('should not have any history', () => {
      assert.isUndefined(lightMachine.initialState.history);
    });
  });

  describe('machine.transition()', () => {
    it('should properly transition states based on string event', () => {
      assert.deepEqual(
        lightMachine.transition('green', 'TIMER').value,
        'yellow'
      );
    });

    it('should properly transition states based on event-like object', () => {
      const event = {
        type: 'TIMER'
      };

      assert.deepEqual(lightMachine.transition('green', event).value, 'yellow');
    });

    it('should not transition states for illegal transitions', () => {
      assert.equal(lightMachine.transition('green', 'FAKE').value, 'green');
      assert.isEmpty(lightMachine.transition('green', 'FAKE').actions);
    });

    it('should throw an error if not given an event', () => {
      // @ts-ignore
      assert.throws(() => (lightMachine.transition as any)('red', undefined));
    });

    it('should transition to nested states as target', () => {
      assert.deepEqual(testMachine.transition('a', 'T').value, { b: 'b1' });
    });

    it('should throw an error for transitions from invalid states', () => {
      assert.throws(() => testMachine.transition('fake', 'T'));
    });

    it('should throw an error for transitions to invalid states', () => {
      assert.throws(() => testMachine.transition('a', 'F'));
    });

    it('should throw an error for transitions from invalid substates', () => {
      assert.throws(() => testMachine.transition('a.fake', 'T'));
    });
  });

  describe('machine.transition() with nested states', () => {
    it('should properly transition a nested state', () => {
      assert.deepEqual(
        lightMachine.transition('red.walk', 'PED_COUNTDOWN').value,
        { red: 'wait' }
      );
    });

    it('should transition from initial nested states', () => {
      assert.deepEqual(lightMachine.transition('red', 'PED_COUNTDOWN').value, {
        red: 'wait'
      });
    });

    it('should transition from deep initial nested states', () => {
      assert.deepEqual(lightMachine.transition('red', 'PED_COUNTDOWN').value, {
        red: 'wait'
      });
    });

    it('should bubble up events that nested states cannot handle', () => {
      assert.equal(lightMachine.transition('red.stop', 'TIMER').value, 'green');
    });

    it('should not transition from illegal events', () => {
      assert.deepEqual(lightMachine.transition('red.walk', 'FAKE').value, {
        red: 'walk'
      });
      assert.isEmpty(lightMachine.transition('red.walk', 'FAKE').actions);

      assert.deepEqual(deepMachine.transition('a1', 'FAKE').value, {
        a1: { a2: { a3: 'a4' } }
      });
      assert.isEmpty(deepMachine.transition('a1', 'FAKE').actions);
    });

    it('should transition to the deepest initial state', () => {
      assert.deepEqual(lightMachine.transition('yellow', 'TIMER').value, {
        red: 'walk'
      });
    });

    it('should return the equivalent state if no transition occurs', () => {
      const initialState = lightMachine.transition(
        lightMachine.initialState,
        'NOTHING'
      );
      const nextState = lightMachine.transition(initialState, 'NOTHING');

      assert.equal(initialState.value, nextState.value);
      assert.isFalse(nextState.changed);
    });
  });

  describe('state key names', () => {
    const machine = Machine({
      key: 'test',
      initial: 'test',
      states: {
        test: {
          activities: ['activity'],
          onEntry: ['onEntry'],
          on: {
            NEXT: 'test'
          },
          onExit: ['onExit']
        }
      }
    });

    it('should work with substate nodes that have the same key', () => {
      assert.deepEqual(
        machine.transition(machine.initialState, 'NEXT').value,
        'test'
      );
    });
  });

  describe('forbidden events', () => {
    it('undefined transitions should forbid events', () => {
      const walkState = lightMachine.transition('red.walk', 'TIMER');

      assert.deepEqual(
        walkState.value,
        { red: 'walk' },
        'Machine should not transition to "green" when in "red.walk"'
      );
    });
  });
});
