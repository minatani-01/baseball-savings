/**
 * node --test 用のモジュール解決フック。
 *
 * Next.js のビルドでは拡張子なしの相対 import と "@/" エイリアスがそのまま通るが、
 * Node の ESM はどちらも解決できない。テストを走らせるためだけに、
 * その2つを補う最小限のフックを入れる。アプリの実行時には使わない。
 */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./test-resolver-hooks.mjs', pathToFileURL('./scripts/'))
