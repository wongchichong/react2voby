import ts, { ScriptKind } from 'typescript'
import { sync as globSync } from 'glob'
import { dirname, join } from 'path'
import yargs from 'yargs'
import fs from 'fs'
import { isPromise } from 'util/types'
import JSON from 'json5'
import { transform } from './transform'
import chalk, { red, green, yellow } from 'chalk'

const fsp = fs.promises

type TsConfig = { compilerOptions: ts.CompilerOptions, exclude: string[] }

const pwd = process.cwd()

console.log()
console.log(chalk.underline.bold("Transforming React source to Voby source."))


const options = yargs(process.argv.slice(2))
    .option('config', {
        alias: 'c',
        describe: 'Path to configuration file',
        type: 'string',
        // demandOption: true, // set this to false if the option is optional
    })
    .help()
    .argv

if (isPromise(options)) {
    console.error("Unknown promise")
}
else {
    const config = options.config ?? "tsconfig.json"
    const cpath = join(pwd, config)

    console.log(chalk.green.bold(`Processing ${cpath}`))

    if (!fs.existsSync(cpath))
        console.log(red(`${cpath} not found.`))
    else {
        console.log(green("config: ") + yellow(cpath))
        const cc: TsConfig = JSON.parse(fs.readFileSync(cpath).toString())

        const r = join(pwd, cc.compilerOptions.rootDir ?? "./")
        const o = join(pwd, "./voby")
        console.log(green("rootDir: ") + yellow(r))
        console.log(green("outDir: ") + yellow(o))

        // console.log(process.argv[2])
        const files = globSync(['**/*.ts', '**/*.tsx'], { cwd: r, ignore: cc.exclude })

        console.log()
        console.log(chalk.underline.bold("Files to process:"))
        console.log(files)
        console.log()


        files.forEach(async f => {
            const src = await fsp.readFile(join(r, f))

            const sk = f.toLowerCase().endsWith('.tsx') ? ScriptKind.TSX : ScriptKind.TS

            const ns = transform(src.toString(), sk)

            const of = join(o, f)

            const p = dirname(of)
            if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })

            fs.writeFileSync(of, ns)

            console.log(green('Done: ') + of + " ✅")
        })
    }
}