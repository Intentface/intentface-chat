// This app's generative UI catalog: the components the model may show through
// the renderUi tool. The tool checks calls against it on the server, and the chat
// draws them with it on the client.

import { defineCatalog, markdown } from "@intentface/ui/generative";
import { z } from "zod";

export const catalog = defineCatalog({
  components: {
    Card: {
      description: "A titled panel that groups related pieces.",
      props: z.object({ title: z.string() }),
      container: true,
      markdown: (props, children) => `${markdown.heading(3, props.title)}\n\n${children}`,
    },
    Metric: {
      description: "One key number or short value with its label, such as a count.",
      props: z.object({ label: z.string(), value: z.string() }),
      markdown: (props) => `- **${markdown.text(props.label)}:** ${markdown.text(props.value)}`,
    },
    Table: {
      description: "Rows under named columns, for comparing items side by side.",
      // A bound row can miss a column, which reads back as null.
      props: z.object({
        columns: z.array(z.string()),
        rows: z.array(z.array(z.string().nullable())),
      }),
      bind: ["rows"],
      markdown: (props) => markdown.table(props.columns, props.rows),
    },
  },
  refDescription: "The ref field of a data tool's result, such as listDocsPages, exactly as given.",
});
