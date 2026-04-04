import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { assigneesOtherThanAuthor } from "../utils/displayUtils";
import { AuthorTag } from "./AuthorTag";

type Props = {
  author: string;
  assignees: string[];
  authorSize?: number;
  assigneeSize?: number;
};

const AuthorWithAssignees: FunctionComponent<Props> = ({
  author,
  assignees,
  authorSize = 18,
  assigneeSize = 15,
}) => {
  const others = assigneesOtherThanAuthor(assignees, author);

  if (others.length === 0) {
    return <AuthorTag login={author} size={authorSize} />;
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, overflow: "hidden" }}>
      <AuthorTag login={author} size={authorSize} />
      <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        {others.map((a, i) => (
          <Tooltip key={a} title={a} placement="top">
            <Box component="span" sx={{ ml: i === 0 ? 0 : "-6px", display: "inline-flex" }}>
              <AuthorTag login={a} size={assigneeSize} showName={false} />
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
};

export { AuthorWithAssignees };
