import { defineCatalog, markdown } from "@intentface/chat/generative";
import { z } from "zod";

/*
 * The components the model may use. Each `props` schema validates what the
 * model wrote and converts to the JSON Schema it is shown; zod 4.2+ does both.
 *
 * The catalog is plain data, so the server's tool and the client's drawing
 * import the same object.
 */
export const catalog = defineCatalog({
  components: {
    Card: {
      description: "A titled panel that groups related pieces.",
      props: z.object({ title: z.string() }),
      container: true,
      markdown: (props, children) => `${markdown.heading(3, props.title)}\n\n${children}`,
    },
    Metric: {
      description: "One key number with its label.",
      props: z.object({ label: z.string(), value: z.string(), note: z.string().optional() }),
      markdown: (props) => `- **${markdown.text(props.label)}:** ${markdown.text(props.value)}`,
    },
    Table: {
      description: "Rows under named columns.",
      props: z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) }),
      // The model may point `rows` at a data tool's result instead of copying it.
      bind: ["rows"],
      markdown: (props) => markdown.table(props.columns, props.rows),
    },
  },
});
