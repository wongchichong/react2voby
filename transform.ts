import ts, { CallExpression, convertToObject, ElementAccessExpression, ObjectLiteralExpression, PropertyAccessExpression, PropertyAssignment, ScriptKind, ShorthandPropertyAssignment, SyntaxKind } from 'typescript'
import { tsquery as tq } from "tsquery"
import 'colors'

//todo: string template
const isInJsx = (node: ts.Node) => {
    // if (ts.isJsxExpression(node)) return true

    const fn = (o: ts.Node) => ts.isJsxElement(o) || ts.isJsxExpression(o) || ts.isJsxOpeningElement(o)
    // if (fn(node.parent.parent)) return true

    // console.log(node.getText())
    let p = node
    while (!!p && !fn(p)) {
        // console.log(p.getText())
        // if (p.getText() === 'arr') {
        // console.log(p.getText(), p.kind.toString().red)
        // console.log(p.parent.getText(), p.parent.kind.toString().red)
        // console.log(p.parent.parent.getText(), p.parent.parent.kind.toString().red)
        // }
        p = p.parent
    }
    // if (node.getText() === 'arr')
    //     console.log(fn(p))

    // return false
    return !!p && fn(p)
}

const trim = (s: string) => s.substring(1, s.length - 2)
const trim2 = (s: string) => s.substring(2, s.length - 4)
const countSpaces = (str: string) => {
    const match = str.match(/^ */) // Match one or more spaces at the beginning of the string
    return match ? match[0].length : 0 // Return the length of the matched substring, or 0 if no match found
}

const visitAllChildren = true

export const transform = (source: string, scriptKind: ScriptKind) => {
    const sourceCode = source ?? `
  export default function TestCode() {
    const [count, setCount] = useState(0);
    const [s, setS] = React.useState(0);
    const arr = useState(null)
    const nor = Math.random

    /* comment */
    function handleClick() {
      setCount(count + 1);
    }

    //comment
    return (
      <div>
        <h1>Counters that update separately</h1>
        <p>{count}</p>
        <button onClick={handleClick}>inc</button>
      </div>
    );
  }
`
    let nc = fixImport(sourceCode, scriptKind)
    nc = fixUseState(nc, scriptKind)
    nc = fixUseCallback(nc, scriptKind)
    nc = fixUse(nc, 'useEffect', scriptKind)
    nc = fixUse(nc, 'useMemo', scriptKind)
    nc = fixUseRef(nc, scriptKind) //having space error, put as last
    // nc = fixClassName(nc)

    nc = nc.replace(/, \)/igm, ')').replace(/,\)/igm, ')')
    return nc
}


// const fixClassName = (nc: string) => tq.replace(nc, "ReturnStatement", n => {
//     // console.log('fixClassName', n.getText())
//     // console.log('p', n.parent.kind, n.parent.getText())
//     console.log('ret', n.kind, n.getText())
//     n.get
//     n.forEachChild(n => {
//         // if (ts.isTypeAssertionExpression(n))

//         console.log('child', n.kind, n.getText())
//         // if (ts.isBinaryExpression(n))
//         // n.forEachChild(n => {
//         //     console.log('n child', n.kind, n.getText())
//         // })
//     })

//     return n.getText()
// })

const fixImport = (nc: string, scriptKind: ScriptKind) => tq.replace(nc, "ImportDeclaration", n => {
    //const mod =  (n.getChildCount() >= 4) ? n.getChildAt(3).getText() : n.getChildAt(1).getText()
    let nc = tq.replace(n.getText(), "ImportSpecifier Identifier[name=useState]", n => '$', { scriptKind })
    nc = tq.replace(nc, "ImportSpecifier Identifier[name=useCallback]", n => '$', { scriptKind })
    nc = tq.replace(nc, "ImportSpecifier Identifier[name=/(use|create)Ref/]", n => '$', { scriptKind })
    nc = tq.replace(nc, "ImportSpecifier Identifier[name=Ref]", n => 'Observable', { scriptKind })
    nc = tq.replace(nc, "ImportSpecifier Identifier[name=MutableRefObject]", n => 'Observable', { scriptKind })
    nc = tq.replace(nc, "ImportDeclaration StringLiteral[value=react]", n => "'voby'", { scriptKind })

    const removeSpaces = (s: string) => {
        let ss = s.replace(/  /igm, ' ')
        while (ss !== s) {
            s = ss
            ss = ss.replace(/  /igm, ' ')
        }
        return ss
    }
    //remove dup
    nc = tq.replace(nc, "NamedImports", n => {
        const t = n.getText()
        const s = new Set(t.slice(1, t.length - 2).split(','))
        const a = [...s]
        return removeSpaces(`{ ${a.join(', ')} }`)
    }, { scriptKind })

    return nc
}, { scriptKind })

const fnExp = (ce: CallExpression) => {
    const ta = ce.typeArguments?.length > 0 ? `<${ce.typeArguments.map(a => a.getText()).join(', ')}>` : ''
    const ag = `(${ce.arguments?.map(a => a.getText()).join(', ')})`
    return `${ta}${ag}`
}
const fnDep = (ce: CallExpression, keepGeneric = true, removeCall = false) => {
    const ta = keepGeneric ? (ce.typeArguments?.length > 0 ? `<${ce.typeArguments.map(a => a.getText()).join(', ')}>` : '') : ''
    const ag = ce.arguments.length === 1 ? (removeCall ? `${ce.arguments[0].getText()}` : `(${ce.arguments[0].getText()})`) : `(${ce.arguments.slice(0, ce.arguments.length - 1).map(a => a.getText()).join(', ')})`
    //const ag = ce.arguments.length === 1 ? `${ce.arguments[0].getText()}` : `${ce.arguments.slice(0, ce.arguments.length - 1).map(a => a.getText()).join(', ')}`
    return `${ta}${ag}`
}

const fixUseState = (nc: string, scriptKind: ScriptKind) => tq.replace(nc, "Block", n => {
    const ns = tq.query(n.getText(), "VariableDeclaration CallExpression[expression.name=useState]", { scriptKind })

    const variable: Record<string, string> = {}
    const keyVal = (fc: ts.Node) => {
        let key = fc.getChildAt(1)?.getChildAt(0)?.getText()
        let val = fc.getChildAt(1)?.getChildAt(2)?.getText() ?? ''
        key = key === '' ? val : key
        return { key, val }
    }

    ns.forEach(n => {
        let p = n.parent
        while (!!p && !ts.isVariableDeclaration(p))
            p = p.parent

        const fc = p.getChildAt(0)
        if (ts.isArrayBindingPattern(fc)) {
            const { key, val } = keyVal(fc)
            if (key === '' && val === '') { }
            else
                variable[key] = val// ts.ArrayBindingElement
        }
        else if (ts.isIdentifier(fc))
            variable[fc.getText()] = ""
    })

    let nc = n.getText()
    // nc = tq.replace(nc, "PropertyAccessExpression > Identifier[name='useState']", n => '$', { visitAllChildren: true,scriptKind })
    //nc = tq.replace(nc, "ArrayBindingPattern > Identifier[name='useState']", n => '$', { visitAllChildren: true,scriptKind })
    nc = tq.replace(nc, "VariableDeclaration:has(CallExpression[expression.name=useState])", n => {
        const fc = n.getChildAt(0)

        const { key } = keyVal(fc)
        const id = (ts.isArrayBindingPattern(fc)) ? (fc.elements.length === 0 ? '{}' : key) : fc.getText()

        return `${id} = $${fnExp(n.getChildAt(2) as CallExpression)}`
    }, { scriptKind })

    Object.keys(variable).forEach(k => {
        //isObjectLiteralExpression 
        nc = tq.replace(nc, `ObjectLiteralExpression ShorthandPropertyAssignment[name='${k}']`, n => `${k}: ${k}`, { visitAllChildren: true, scriptKind })

        nc = tq.replace(nc, `Identifier[name='${k}']`, n => {
            if (ts.isVariableDeclaration(n.parent) || isInJsx(n) ||
                ts.isElementAccessExpression(n.parent) ||
                ts.isObjectLiteralExpression(n.parent) ||
                ts.isBindingElement(n.parent) ||
                ts.isPropertyAssignment(n.parent))
                return n.getText()

            return k + '()'
        }, { visitAllChildren: true, scriptKind })

        //isElementAccessExpression
        nc = tq.replace(nc, `ElementAccessExpression:has(Identifier[name='${k}'])`, n => {
            if (n.getChildAt(2).getText() === '0') //getter
                return k + '()'
            else if (n.getChildAt(2).getText() === '1') //setter
                return k

            return n.getText()
        }, { visitAllChildren: true, scriptKind })

        //convert object literal PropertyAssignment right side
        const ro: (nc: string) => string = (nc: string) => tq.replace(nc, `ObjectLiteralExpression PropertyAssignment:has(Identifier[name='${k}']) > :last-child`, n => {
            if (ts.isIdentifier(n))
                return k + '()'
            else if (ts.isObjectLiteralExpression(n))
                return trim(ro(`(${n.getText()})`))

            return n.getText()
        }, { visitAllChildren: true, scriptKind })

        nc = ro(nc)

        if (variable[k]) {
            nc = tq.replace(nc, `ShorthandPropertyAssignment Identifier[name=${variable[k]}]`, n => {
                if (ts.isIdentifier(n))
                    return k

                return k + '()'
            }, { visitAllChildren: true, scriptKind })

            nc = tq.replace(nc, `CallExpression Identifier[name='${variable[k]}']`, n => {
                if (ts.isVariableDeclaration(n.parent))
                    return n.getText()

                return k
            }, { visitAllChildren: true, scriptKind })
        }

        /**
         * convert 
         * {
         *      a: a(),
         *      a
         * }
         * * to { a }
         * todo
         */
        const no = (nc: string): string => tq.replace(nc, `ObjectLiteralExpression`, n => {
            let nc = `${n.getText()}`.split('\n')
            let curly = nc.length === 1 ? 0 : countSpaces(nc[nc.length - 1])
            let inner = nc.length === 1 ? 0 : countSpaces(nc[2])

            const ol = n as ObjectLiteralExpression
            const dic = new Set<string>()
            const del = new Set<string>()

            let o = ol.properties.map((p, i, a) => {
                // console.log(p.kind.toString().red)
                if (p.name) {
                    const pk = p.name.getText()
                    if (dic.has(pk)) {
                        console.log(pk.red)
                        del.add(pk)
                    }
                    dic.add(pk)
                    if (ts.isPropertyAssignment(p))
                        return [pk, p.initializer.getText()]
                    else {
                        // console.log(SyntaxKind[p.kind].red)
                        return [p.getText()]
                    }
                }
                else
                    return [p.getText()]
                // console.log(p.name?.getText().yellow, (ts.isPropertyAssignment(p) ? p.initializer.getText().red : ""))
            })

            o = o.filter(e => !(e.length === 2 && del.has(e[0])))

            console.log(o)
            const fixProperty = (o: string[]) => {
                if (o.length === 1)
                    return o[0]
                else
                    return `${o[0]}: ${o[1]}`
            }

            // console.log(`{
            // ${o.map(k => `${' '.repeat(inner)}${fixProperty(k)}`).join(',\n')}
            // ${' '.repeat(curly)}}`)

            return `{
${o.map(k => `${' '.repeat(inner)}${fixProperty(k)}`).join(',\n')}
${' '.repeat(curly)}}`

            // console.log(nc.red)
            //const ns = tq.query(nc, `PropertyAssignment:first-child:has(Identifier[name='${k}']), ShorthandPropertyAssignment:has(Identifier[name='${k}'])`, { scriptKind })

            // if (ns.length >= 2) {
            //     nc = trim(tq.replace(nc, `PropertyAssignment:first-child:has(Identifier[name='${k}'])`, n => '', { visitAllChildren: true, scriptKind }))
            //     // console.log('\n\n', nc.red, '\n\n',)
            // }

            // nc = /* trim */tq.replace(nc, `PropertyAssignment`, n => {
            //     if (ts.isObjectLiteralExpression(n.getChildAt(2))) {
            //         let nc = `({${n.getText()}})`
            //         // //     console.log('obj'.red, `(${n.getText()})`)
            //         const ns = tq.query(nc, `PropertyAssignment PropertyAssignment:has(Identifier[name='${k}']), ShorthandPropertyAssignment:has(Identifier[name='${k}'])`, { scriptKind, visitAllChildren: false })
            //         if (ns.length >= 2)
            //             nc = tq.replace(nc, `PropertyAssignment PropertyAssignment:has(Identifier[name='${k}'])`, n => '', { scriptKind })

            //         return trim2(nc)
            //         // nc = no(nc)
            //     }
            //     return n.getText()
            // }, { scriptKind, visitAllChildren })

        }, { scriptKind, visitAllChildren })
        // nc = no(nc)
    })

    return nc
}, { scriptKind })

/**
 * useRef, createRef
 * @param nc 
 * @param scriptKind 
 * @returns 
 */
const fixUseRef = (nc: string, scriptKind: ScriptKind) => {
    const ns = tq.query(nc, "VariableDeclaration CallExpression[expression.name=/(use|create)Ref/]", { scriptKind })

    const variable: Record<string, string> = {}

    ns.forEach(n => {
        let p = n.parent
        while (!!p && !ts.isVariableDeclaration(p))
            p = p.parent

        const fc = p.getChildAt(0)
        variable[fc.getText()] = ""
    })

    let dic = new Set<string>()
    nc = tq.replace(nc, "VariableDeclaration:has(CallExpression[expression.name=/(use|create)Ref/])", n => {
        const fc = n.getChildAt(0)

        const id = (ts.isArrayBindingPattern(fc)) ? fc.getChildAt(1).getChildAt(0).getText() : fc.getText()

        dic.add(id)
        return `${id} = $${fnExp(n.getChildAt(2) as CallExpression)}`
    }, { scriptKind })
    //other than variable declarataion, exclude createRefCache
    nc = tq.replace(nc, "CallExpression Identifier[name=/(use|create)Ref$/]", n => `$`, { scriptKind })

    nc = tq.replace(nc, "BinaryExpression", n => {
        if (ts.isBinaryExpression(n))
            if (ts.isPropertyAccessExpression(n.left))
                if (dic.has(n.left.getChildAt(0).getText()) && n.left.getChildAt(2).getText() === 'current')
                    //            console.log(n.left.getChildAt(0).getText().red, n.left.getChildAt(2).getText(), n.right.getText())
                    return `${n.left.getChildAt(0).getText()}(${n.right.getText()})`

        return n.getText()
    }, { scriptKind })

    // nc = tq.replace(nc, ":has(PropertyAccessExpression Identifier[name=current])", ((n: PropertyAccessExpression) => {
    const np = (nc: string) => tq.replace(nc, "PropertyAccessExpression:has(Identifier[name=current])", ((n: PropertyAccessExpression) => {
        if (dic.has(n.expression.getText()) && n.name.getText() === 'current')
            return `${n.getChildAt(0).getText()}()`

        else if (ts.isPropertyAccessExpression(n.expression))
            return np(n.expression.getText()) + '.' + n.name.getText()

        // console.log(n.getText().red, n.expression.kind, n.name.getText().green, n.expression.getText().blue, dic.has(n.expression.getText()), n.name.getText() === 'current')

        return n.getText()
    }) as any, { scriptKind, visitAllChildren })
    nc = np(nc)

    nc = tq.replace(nc, "TypeReference Identifier[name=Ref]", n => 'Observable', { scriptKind, visitAllChildren })
    nc = tq.replace(nc, "TypeReference Identifier[name=MutableRefObject]", n => 'Observable', { scriptKind, visitAllChildren })

    return nc
}

const fixUseCallback = (nc: string, scriptKind: ScriptKind) => {
    nc = tq.replace(nc, "Block", n => tq.replace(n.getText(), "VariableDeclaration CallExpression[expression.name=useCallback]", n => {
        // console.log('')
        return `${fnDep(n as CallExpression, false)}`
    }, { scriptKind, visitAllChildren }), { scriptKind, visitAllChildren })
    // nc = tq.replace(nc, "Block", n => tq.replace(n.getText(), "VariableDeclaration CallExpression Identifier[name=useCallback]", n => '$', { scriptKind }), { scriptKind })

    return nc
}

const fixUse = (nc: string, hook = 'useEffect', scriptKind: ScriptKind): string => {
    nc = tq.replace(nc, `CallExpression[expression.name="${hook}"]`, ((n: CallExpression) => {
        return `${hook}${fnDep(n)}`
    }) as any, { scriptKind })

    nc = tq.replace(nc, `CallExpression:has(PropertyAccessExpression Identifier[name="${hook}"])`, ((n: CallExpression) => {
        return `${hook}${fnDep(n)}`
    }) as any, { scriptKind })

    return nc
}