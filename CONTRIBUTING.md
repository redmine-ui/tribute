## Contributing

We welcome contributions to Tribute. There are many areas where we would love to see community contributions that we have outlined below, but first, let's go over how to develop in Tribute.

Install dependencies:

```sh
npm install
```

Run Rollup:

```sh
npm run start
```

That's it! Now you can use the `example/index.html` to test out changes to the code base. All changes to `src` will recompile on the fly.

Once you have made your changes, feel free to submit a pull request.

## Testing

We use [@web/test-runner](https://modern-web.dev/docs/test-runner/overview/)

To run the tests type:

```
npm run build
npm run test
```

## Contribution Ideas

The major focus that we could use your help with is creating wrappers for different JavaScript frameworks. Some of the ones we are interested in are outlined below. We also see a couple of areas for improving compatibility with different rendering situations, such as in iframes inside of rich text editors.

**Some ideas that are for grabs**

- Prosemirror component
- `noMatchTemplate` per collection.
