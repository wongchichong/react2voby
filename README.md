# react2voby

Transform React code to Voby

Read 'rootDir' & 'exclude' from tsconfig.ts 
and outputs to ./voby folder

``` bs
react2voby --config test.tsconfig.json
```

 --config is optional


## From (useState, useEffect, useCallback)

``` ts
import React, { useCallback, useState, useEffect } from 'react'
import * as M from Math
import { random } from Math
import 'some'

export default function MyApp() {
    /* comment */
    const [count, setCount] = useState<number>(0)
    const [s] = useState(0)
    const a = useState([])
    const [, hack] = useState(0)
    const [] = useState(0)
    const arr = useState<{}>(null)
    const onClick = useCallback<() => void>(() => { })
    const [value, setValue] = useState(0)

    function handleClick() {
        setCount(count + 1)
    }

    useEffect(() => {
        (() => { })()

        console.log(arr[0])
        arr[1](123)
    }, [arr])

    React.useEffect(() => {
        (() => { })()

        console.log(count)
    }, [count])

    React.useEffect(() => {
        (() => { })()
        console.log(a[0][0])
    }, ...arr)

    const obj = { count, SS: s }

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLSpanElement>) => {
            onKeyDown?.(event)

            if (tryToSubmitRelatedForm(event)) {
                return
            }

            if (
                ![" ", "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(
                    event.key
                )
            ) {
                return
            }

            /* istanbul ignore next: can't really happen */
            const radio = (event.target as HTMLElement)?.closest<HTMLSpanElement>(
                '[role="radio"]'
            )
            if (!radio) {
                return
            }

            event.preventDefault()
            event.stopPropagation()
            if (event.key === " ") {
                radio.click()
                return
            }

            const increment =
                event.key === "ArrowRight" || event.key === "ArrowDown"
            const index = refs.findIndex(({ current }) => current === radio)
            /* istanbul ignore next: can't really happen */
            if (index !== -1) {
                const nextIndex = loop({
                    value: index,
                    max: items.length - 1,
                    increment,
                })
                refs[nextIndex].current?.focus()
                onChange(getRadioItemValue(items[nextIndex]))
            }
        },
        [onChange, onKeyDown]
    )


    // comment
    return <div style={{}} className="css">
        <h1>Counters that update separately</h1>
        <span>{count}{a}</span>
        <span>{s}</span>
        <button onClick={handleClick} value={value}>increment</button>
    </div>
}
```

## Transformed code

``` ts
import React, { $, useEffect } from 'voby'
import * as M from Math
import { random } from Math
import 'some'

export default function MyApp() {
    /* comment */
    const count = $<number>(0)
    const s = $(0)
    const a = $([])
    const hack = $(0)
    const {} = $(0)
    const arr = $<{}>(null)
    const onClick = () => { }
    const value = $(0)

    function handleClick() {
        count(count() + 1)
    }

    useEffect() => {
        (() => { })()

        console.log(arr())
        arr(123)
    }

    useEffect() => {
        (() => { })()

        console.log(count())
    }

    useEffect() => {
        (() => { })()
        console.log(a()
    }

    const obj = { count(), SS: s() }

    const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
            onKeyDown?.(event)

            if (tryToSubmitRelatedForm(event)) {
                return
            }

            if (
                ![" ", "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(
                    event.key
                )
            ) {
                return
            }

            /* istanbul ignore next: can't really happen */
            const radio = (event.target as HTMLElement)?.closest<HTMLSpanElement>(
                '[role="radio"]'
            )
            if (!radio) {
                return
            }

            event.preventDefault()
            event.stopPropagation()
            if (event.key === " ") {
                radio.click()
                return
            }

            const increment =
                event.key === "ArrowRight" || event.key === "ArrowDown"
            const index = refs.findIndex(({ current }) => current === radio)
            /* istanbul ignore next: can't really happen */
            if (index !== -1) {
                const nextIndex = loop({
                    value: value(),
                    max: items.length - 1,
                    increment,
                })
                refs[nextIndex].current.focus()
                onChange(getRadioItemValue(items[nextIndex]))
            }
        }


    // comment
    return <div style={{}} className="css">
        <h1>Counters that update separately</h1>
        <span>{count}{a}</span>
        <span>{s}</span>
        <button onClick={handleClick} value={value}>increment</button>
    </div>
}
```

## From (useRef, useCallback)

``` ts
import type { MutableRefObject } from "react";
import { useCallback, useRef } from "react";

type CurrentValueRef<T> = MutableRefObject<T>;
type SetValue<T> = (nextValue: T) => void;
type ResetValue = () => void;

type ReturnValue<T> = [CurrentValueRef<T>, SetValue<T>, ResetValue];

/**
 * Creates a temporary value that gets reset every `x`ms back to the provided
 * default value. This is useful when doing keyboard searching or other
 * interactions.
 *
 * NOTE: This does not force a re-render when the value changes and instead uses
 * a ref value instead.
 *
 * @typeParam T - the type for the value
 * @param defaultValue - The default value to use. Each time the reset timeout
 * is triggered, this value will be set again.
 * @param resetTime - The amount of time before the value is reset back to the
 * default value
 */
export function useTempValue<T>(
  defaultValue: T,
  resetTime = 500
): ReturnValue<T> {
  const value = useRef(defaultValue);
  const timeout = useRef<number>();
  const resetValue = useCallback(() => {
    window.clearTimeout(timeout.current);
    value.current = defaultValue;
  }, [defaultValue]);

  const setValue = useCallback(
    (nextValue: T) => {
      value.current = nextValue;
      window.clearTimeout(timeout.current);
      timeout.current = window.setTimeout(resetValue, resetTime);
    },
    [resetTime, resetValue]
  );

  return [value, setValue, resetValue];
}

```

## Transformed code
``` ts
import type { Observable } from 'voby';
import { $ } from 'voby';

type CurrentValueRef<T> = Observable<T>;
type SetValue<T> = (nextValue: T) => void;
type ResetValue = () => void;

type ReturnValue<T> = [CurrentValueRef<T>, SetValue<T>, ResetValue];

/**
 * Creates a temporary value that gets reset every `x`ms back to the provided
 * default value. This is useful when doing keyboard searching or other
 * interactions.
 *
 * NOTE: This does not force a re-render when the value changes and instead uses
 * a ref value instead.
 *
 * @typeParam T - the type for the value
 * @param defaultValue - The default value to use. Each time the reset timeout
 * is triggered, this value will be set again.
 * @param resetTime - The amount of time before the value is reset back to the
 * default value
 */
export function useTempValue<T>(
  defaultValue: T,
  resetTime = 500
): ReturnValue<T> {
  const value = $(defaultValue);
  const timeout = $<number>();
  const resetValue = () => {
    window.clearTimeout(timeout());
    value(defaultValue);
  };

  const setValue = (nextValue: T) => {
      value(nextValue);
      window.clearTimeout(timeout());
      timeout(window.setTimeout(resetValue, resetTime));
    };

  return [value, setValue, resetValue];
}

```

Known issues:
Renamed imports will be not processed.

If [https://github.com/phenomnomnominal/tsquery](https://github.com/phenomnomnominal/tsquery) pull not done, please use this:
[https://github.com/wongchichong/tsquery](https://github.com/wongchichong/tsquery)