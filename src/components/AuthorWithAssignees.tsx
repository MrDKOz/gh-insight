import type { FunctionComponent } from "react";
import Box from "@mui/material/Box";
import { assigneesOtherThanAuthor } from "../utils/displayUtils";
import { AuthorTag, RoleLabel } from "./AuthorTag";

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
  assigneeSize = 16,
}) => {
  const others = assigneesOtherThanAuthor(assignees, author);

  if (others.length === 0) {
    return <AuthorTag login={author} size={authorSize} />;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <Box>
        <RoleLabel text="by" />
        <AuthorTag login={author} size={authorSize} />
      </Box>
      <Box>
        <RoleLabel text="assigned" />
        <Box sx={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {others.map((a) => (
            <AuthorTag key={a} login={a} size={assigneeSize} />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export { AuthorWithAssignees };
