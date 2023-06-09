// import { $, useEffect, render } from 'voby'
// import { useReact } from 'use-voby'
import React from 'react'
import { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import CodeEditor, { TextareaCodeEditorProps } from '@uiw/react-textarea-code-editor'
import { transform } from '../src/transform'
import { ScriptKind } from 'typescript'
import { version } from '../package.json'


const Transformer = () => {
    const [code, setCode] = useState(`import React, { useCallback, useState, useEffect } from 'react'
import * as M from Math
import { random } from Math

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
}`
    )
    const [trans, setTrans] = useState(transform(code, ScriptKind.TSX))

    useEffect(() => setTrans(transform(code, ScriptKind.TSX)), [code])

    function copyAll() {
        // Get the content element
        var contentElement = document.getElementById('transformed')

        // Create a range and select the content
        var range = document.createRange()
        range.selectNode(contentElement)

        // Create a selection and add the range
        var selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)

        // Copy the selected content to the clipboard
        document.execCommand('copy')

        // Clear the selection
        selection.removeAllRanges()
    }

    return <>
        <h1>React to Voby Transformer ({version}) <a href="https://github.com/wongchichong/react2voby">
            <svg height="32" aria-hidden="true" viewBox="0 0 16 16" version="1.1" width="32" data-view-component="true">
                <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
            </svg>
        </a> <a href="https://www.npmjs.com/package/react2voby">
                <svg xmlns="http://www.w3.org/2000/svg" width="25" height="20" viewBox="0 0 256 100" preserveAspectRatio="xMinYMin meet">
                    <path d="M0 0v85.498h71.166V99.83H128V85.498h128V0H0z" fill="#CB3837" />
                    <path d="M42.502 14.332h-28.17v56.834h28.17V28.664h14.332v42.502h14.332V14.332H42.502zM85.498 14.332v71.166h28.664V71.166h28.17V14.332H85.498zM128 56.834h-13.838v-28.17H128v28.17zM184.834 14.332h-28.17v56.834h28.17V28.664h14.332v42.502h14.332V28.664h14.332v42.502h14.332V14.332h-57.328z" fill="#FFF" />
                </svg></a></h1>
        <h4>Paste <button title='Paste' onClick={() => (async () => {
            try {
                const text = await navigator.clipboard.readText()
                setCode(text)
            } catch (error) {
                console.log('Failed to read clipboard')
            }
        })()}> <svg xmlns="http://www.w3.org/2000/svg" fill="#000000" height="14" width="14" version="1.1" id="Layer_1" viewBox="0 0 502 502">
                <g>
                    <path d="M467.35,190.176l-70.468-70.468c-1.876-1.875-4.419-2.929-7.071-2.929h-23.089V49c0-5.523-4.478-10-10-10h-115v-2.41     c0-20.176-16.414-36.59-36.59-36.59h-11.819c-20.176,0-36.591,16.415-36.591,36.59V39h-115c-5.522,0-10,4.477-10,10v386     c0,5.523,4.478,10,10,10h146.386v47c0,5.523,4.478,10,10,10h262.171c5.522,0,10-4.477,10-10V197.247     C470.279,194.595,469.225,192.051,467.35,190.176z M399.811,150.921l36.326,36.326h-36.326V150.921z M144.721,59h47     c5.522,0,10-4.477,10-10s-4.478-10-10-10h-15v-2.41c0-9.148,7.442-16.59,16.591-16.59h11.819c9.147,0,16.59,7.442,16.59,16.59V49     c0,5.523,4.478,10,10,10h22v20h-109V59z M198.107,116.779c-5.522,0-10,4.477-10,10V425H51.721V59h73v30c0,5.523,4.478,10,10,10     h129c5.522,0,10-4.477,10-10V59h73v57.779H198.107z M450.278,482H208.107V136.779H379.81v60.468c0,5.523,4.478,10,10,10h60.468     V482z" />
                    <path d="M243.949,253.468h125.402c5.522,0,10-4.477,10-10c0-5.523-4.478-10-10-10H243.949c-5.522,0-10,4.477-10,10     C233.949,248.991,238.427,253.468,243.949,253.468z" />
                    <path d="M414.437,283.478H243.949c-5.522,0-10,4.477-10,10s4.478,10,10,10h170.487c5.522,0,10-4.477,10-10     S419.959,283.478,414.437,283.478z" />
                    <path d="M414.437,333.487H243.949c-5.522,0-10,4.477-10,10s4.478,10,10,10h170.487c5.522,0,10-4.477,10-10     S419.959,333.487,414.437,333.487z" />
                    <path d="M414.437,383.497H243.949c-5.522,0-10,4.477-10,10s4.478,10,10,10h170.487c5.522,0,10-4.477,10-10     S419.959,383.497,414.437,383.497z" />
                    <path d="M397.767,253.468h16.67c5.522,0,10-4.477,10-10c0-5.523-4.478-10-10-10h-16.67c-5.522,0-10,4.477-10,10     C387.767,248.991,392.245,253.468,397.767,253.468z" />
                </g>
            </svg></button> your React here: <button title='Clear' onClick={() => { setCode(''); setTrans('') }}>▢</button>
        </h4 >
        <CodeEditor
            value={code}
            language="js"
            placeholder="Please enter TS code."
            onChange={(evn) => { setCode(evn.target.value) }}
            padding={15}
            style={{
                fontSize: 12,
                backgroundColor: "#f5f5f5",
                fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
                height: '20rem',
                overflow: 'auto'
            }}
        />
        <br />
        <h4>Voby here:  <button title='Copy' onClick={() => copyAll()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="1rem" height="1rem" viewBox="0 0 20 20" fill="none">
                <path fill="#000000" fillRule="evenodd" d="M4 2a2 2 0 00-2 2v9a2 2 0 002 2h2v2a2 2 0 002 2h9a2 2 0 002-2V8a2 2 0 00-2-2h-2V4a2 2 0 00-2-2H4zm9 4V4H4v9h2V8a2 2 0 012-2h5zM8 8h9v9H8V8z" />
            </svg>
        </button></h4>
        <CodeEditor id={'transformed'}
            value={trans}
            language="js"
            placeholder="Transformed code."
            readOnly
            padding={15}
            style={{
                fontSize: 12,
                backgroundColor: "#f5f5f5",
                fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
                height: '20rem',
                overflow: 'auto',
            }}
        />
    </>
}

const root = createRoot(document.getElementById('app'))
root.render(<Transformer />)