import { SmartNote } from "../types";

const GITEE_API_BASE = "https://gitee.com/api/v5";

export const getGist = async (gistId: string, accessToken: string): Promise<SmartNote[]> => {
  try {
    const response = await fetch(`${GITEE_API_BASE}/gists/${gistId}?access_token=${accessToken}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Gist: ${response.statusText}`);
    }
    const data = await response.json();
    const fileContent = data.files['smart_notes.json']?.content;
    
    if (!fileContent) {
      throw new Error("Gist found, but 'smart_notes.json' is missing.");
    }
    
    return JSON.parse(fileContent);
  } catch (error) {
    console.error("Gitee Load Error:", error);
    throw error;
  }
};

export const createGist = async (notes: SmartNote[], accessToken: string): Promise<string> => {
  try {
    const response = await fetch(`${GITEE_API_BASE}/gists`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: accessToken,
        files: {
          "smart_notes.json": {
            content: JSON.stringify(notes, null, 2)
          }
        },
        description: "Smart Note AI Data Store",
        public: false
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create Gist: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error("Gitee Create Error:", error);
    throw error;
  }
};

export const updateGist = async (gistId: string, notes: SmartNote[], accessToken: string): Promise<void> => {
  try {
    const response = await fetch(`${GITEE_API_BASE}/gists/${gistId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: accessToken,
        files: {
          "smart_notes.json": {
            content: JSON.stringify(notes, null, 2)
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to update Gist: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Gitee Update Error:", error);
    throw error;
  }
};