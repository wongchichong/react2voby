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