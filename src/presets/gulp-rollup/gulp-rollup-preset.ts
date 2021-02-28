import inquirer from 'inquirer';
import path from 'path';

import { Options } from '../../options';
import { Preset, TargetFilePath, TemplateFilePath } from '../preset';
import generateProgrammaticFiles from './generate-programmatic-files';
import getTemplateFiles from './get-template-files';

export class GulpRollupPreset implements Preset {
  protected name: string;
  protected options: Options;
  protected gulpRollupOptions: GulpRollupOptions;

  constructor(name: string, options: Options, gulpRollupOptions: GulpRollupOptions) {
    this.name = name;
    this.options = options;
    this.gulpRollupOptions = gulpRollupOptions;
  }

  async getProgrammaticFiles(): Promise<Record<TargetFilePath, string>> {
    return generateProgrammaticFiles(this.name, this.options, this.gulpRollupOptions);
  }

  async getTemplateFiles(): Promise<Record<TargetFilePath, TemplateFilePath>> {
    return getTemplateFiles(this.name, this.gulpRollupOptions);
  }

  async getTemplateVariables(): Promise<Record<string, unknown>> {
    const eslintPlugins = [];
    if (this.gulpRollupOptions.useTypeScript) {
      eslintPlugins.push("'@typescript-eslint'");
    }
    if (this.gulpRollupOptions.useTesting) {
      eslintPlugins.push("'jest'");
    }
    return { ...this.gulpRollupOptions, eslintPlugins };
  }

  async getAdditionalDirectories(): Promise<string[]> {
    return ['assets', 'fonts', 'lang', 'packs'].map((directory) => path.join('src', directory));
  }

  async getDependencies(): Promise<string[]> {
    return [];
  }

  async getDevDependencies(): Promise<string[]> {
    let devDependencies = ['@rollup/plugin-node-resolve', 'chalk', 'fs-extra', 'gulp', 'rollup', 'semver', 'yargs'];
    if (this.gulpRollupOptions.useTypeScript) {
      devDependencies = devDependencies.concat([
        'foundry-vtt-types@github:League-of-Foundry-Developers/foundry-vtt-types#906f1cef577eac1fae22103b5875c13fbb08addf',
        'rollup-plugin-typescript2',
        'tslib',
        'typescript',
      ]);
    }
    if (this.gulpRollupOptions.useLinting) {
      devDependencies = devDependencies.concat([
        'eslint',
        'eslint-config-prettier',
        'eslint-plugin-prettier',
        'husky',
        'lint-staged',
        'prettier',
      ]);

      if (this.gulpRollupOptions.useTypeScript) {
        devDependencies = devDependencies.concat('@typescript-eslint/eslint-plugin', '@typescript-eslint/parser');
      } else {
        devDependencies = devDependencies.concat('@typhonjs-fvtt/eslint-config-foundry.js@0.7.9');
      }

      if (this.gulpRollupOptions.useTesting) {
        devDependencies = devDependencies.concat('eslint-plugin-jest');
      }
    }
    if (this.gulpRollupOptions.useTesting) {
      devDependencies = devDependencies.concat(['jest', 'jest-junit']);

      if (this.gulpRollupOptions.useTypeScript) {
        devDependencies = devDependencies.concat(['@types/jest', 'ts-jest']);
      }
    }
    if (this.gulpRollupOptions.styleType === 'less') {
      devDependencies = devDependencies.concat(['gulp-less', 'less@3']);
    }
    if (this.gulpRollupOptions.styleType === 'scss') {
      devDependencies = devDependencies.concat(['gulp-sass', 'sass']);
    }
    return devDependencies;
  }

  async getPostInstallationCommands(): Promise<string[]> {
    return this.gulpRollupOptions.useLinting && this.options.deps
      ? ['npm exec husky install', "npx husky add .husky/pre-commit 'npx lint-staged'", 'npm run format']
      : [];
  }

  static async create(name: string, options: Options): Promise<GulpRollupPreset> {
    const { features }: { features: string[] } = await inquirer.prompt([
      {
        name: 'features',
        type: 'checkbox',
        message: 'Check the features needed for your project:',
        choices: [
          {
            name: 'TypeScript',
            value: 'typescript',
          },
          { name: 'Linter / Formatter', value: 'linter', checked: true },
          { name: 'Unit Testing', value: 'test' },
          {
            name: 'CSS Pre-processor',
            value: 'cssPreProcessor',
          },
        ],
      },
    ]);
    const useTypeScript = features.find((it) => it === 'typescript') !== undefined;
    const useLinting = features.find((it) => it === 'linter') !== undefined;
    const useTesting = features.find((it) => it === 'test') !== undefined;
    const useCssPreProcessor = features.find((it) => it === 'cssPreProcessor') !== undefined;
    const styleType = await getStyleType(useCssPreProcessor);

    return new GulpRollupPreset(name, options, { useTypeScript, useLinting, useTesting, styleType });
  }

  static async createDefault(name: string, options: Options): Promise<GulpRollupPreset> {
    return new GulpRollupPreset(name, options, GulpRollupPreset.defaultRollupOptions);
  }

  private static defaultRollupOptions = {
    useTypeScript: false,
    useLinting: true,
    useTesting: false,
    styleType: 'css' as const,
  };
}

async function getStyleType(useCssPreProcessor: boolean): Promise<GulpRollupOptions['styleType']> {
  if (!useCssPreProcessor) {
    return 'css';
  }
  const { styleType }: { styleType: 'less' | 'scss' } = await inquirer.prompt([
    {
      name: 'styleType',
      type: 'list',
      message: 'Pick a CSS pre-processor',
      choices: [
        { name: 'Sass (.scss)', value: 'scss' },
        { name: 'Less', value: 'less' },
      ],
    },
  ]);
  return styleType;
}

export interface GulpRollupOptions {
  useTypeScript: boolean;
  useLinting: boolean;
  useTesting: boolean;
  styleType: 'css' | 'less' | 'scss';
}