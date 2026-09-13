const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    background: "./src/background.ts",
    content: "./src/content.ts",
    popup: "./src/popup.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: "manifest.json", to: "manifest.json" },
        { from: "src/popup.html", to: "popup.html" },
        { from: "src/content.css", to: "content.css" },
        { from: "dashboard", to: "dashboard" },
        { from: "icons", to: "icons", noErrorOnMissing: true },
        // PDF.js worker + build (same role as vite-plugin-static-copy)
        {
          from: "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
          to: "pdf.worker.min.mjs",
        },
        {
          from: "node_modules/pdfjs-dist/build/pdf.min.mjs",
          to: "pdf.min.mjs",
        },
      ],
    }),
  ],
  optimization: {
    minimize: false,
  },
  devtool: "cheap-module-source-map",
  performance: {
    hints: false,
  },
};
