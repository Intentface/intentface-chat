// A release line is the changeset's summary alone: no PR link, commit hash or credit.
/** @type {import("@changesets/types").ChangelogFunctions} */
module.exports = {
  // A summary is one line, or a list of them (see README.md).
  getReleaseLine: async ({ summary }) => {
    const line = summary.trim();
    return line.startsWith("- ") ? line : `- ${line}`;
  },
  getDependencyReleaseLine: async () => "",
};
