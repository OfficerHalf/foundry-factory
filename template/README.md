# project-name

Your description here.

## Installation

Your installation instructions here.

## Development

### Prerequisites

In order to build this project, recent versions of `node` and `npm` are
required. Most likely using `yarn` also works but only `npm` is officially
supported. We recommend using the latest lts version of `node`, which is
`v14.15.5` at the time of writing. If you use `nvm` to manage your `node`
versions, you can simply run

```
nvm install
```

in the project's root directory.

You also need to install the the project's dependencies. To do so, run

```
npm install
```

### Building

You can build the project by running

```
npm run build
```

Alternatively, you can run

```
npm run build:watch
```

to watch for changes and automatically build as necessary.

### Linking the built project to Foundry VTT

In order to provide a fluent development experience, it is recommended to link
the built system to your local Foundry VTT installation's data folder. In order
to do so, first add a file called `foundryconfig.json` to the project root with
the following content:

```
{
    "dataPath": "<path to your home directory>/.local/share/FoundryVTT"
}
```

On platforms other than Linux you need to adjust the path accordingly.

Then run

```
npm run link-project
```

### Running the tests

You can run the tests with the following command:

```
npm test
```