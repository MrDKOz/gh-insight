import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { FS, assigneesOtherThanAuthor } from "../utils/displayUtils";
import { AuthorTag } from "./AuthorTag";

type Props = {
  author: string;
  assignees: string[];
  authorSize?: number;
  assigneeSize?: number;
};

const RowLabel: FunctionComponent<{ text: string }> = ({ text }) => (
  <Typography component="span" sx={{ fontSize: FS.tiny, color: "text.disabled", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
    {text}
  </Typography>
);

const AuthorWithAssignees: FunctionComponent<Props> = ({
  author,
  assignees,
  authorSize = 18,
  assigneeSize = 16,
}) => {
  const others = assigneesOtherThanAuthor(assignees, author);

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "max-content 1fr", alignItems: "center", gap: "4px 6px" }}>
      <RowLabel text="By" />
      <AuthorTag login={author} size={authorSize} />
      {/* Always render the Assigned row so the label column is consistently sized.
          When there are no assignees the row collapses to zero height. */}
      <Box sx={{ height: others.length === 0 ? 0 : "auto", overflow: "hidden" }}>
        <RowLabel text="Assigned" aria-hidden={others.length === 0} />
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px", height: others.length === 0 ? 0 : "auto", overflow: "hidden" }}>
        {others.map((a) => (
          <AuthorTag key={a} login={a} size={assigneeSize} />
        ))}
      </Box>
    </Box>
  );
};

export { AuthorWithAssignees };
