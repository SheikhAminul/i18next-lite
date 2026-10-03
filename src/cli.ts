#!/usr/bin/env node
/// <reference types="node" />
import { cli } from './extract.js'

process.exitCode = cli(process.argv.slice(2))
