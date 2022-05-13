import { expect, jest } from "@jest/globals";
import { OrgSettings } from "@baseplate-sdk/utils";
import { handleApps } from "./handleApps";
import { MockCloudflareKV } from "./setupTests";
import { sendMock } from "@aws-sdk/client-s3";

describe(`handleApps`, () => {
  let response: Response,
    mockFetch = jest.fn();

  beforeEach(() => {
    mockFetch = jest.fn();
    // @ts-ignore
    global.fetch = mockFetch;

    response = null;
  });

  it(`determines correct proxy url when using Baseplate hosting`, async () => {
    mockFetch.mockReturnValueOnce(
      new Response("console.log('hi');", {
        status: 200,
      })
    );

    response = await handleApps(
      new Request(
        "https://cdn.single-spa-baseplate.com/walmart/apps/navbar/c1a777c770ee187cebedd0724653c771495f2af9/react-mf-navbar.js"
      ),
      {
        orgKey: "walmart",
        customerEnv: "__main__",
        pathParts: [
          "navbar",
          "c1a777c770ee187cebedd0724653c771495f2af9",
          "react-mf-navbar.js",
        ],
      }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect((mockFetch.mock.calls[0][0] as Request).url).toBe(
      "https://cdn.baseplate.cloud/navbar/c1a777c770ee187cebedd0724653c771495f2af9/react-mf-navbar.js"
    );
  });

  it(`determines correct proxy url when not using custom hosting`, async () => {
    const orgSettings: RecursivePartial<OrgSettings> = {
      orgExists: true,
      staticFiles: {
        microfrontendProxy: {
          environments: {
            __main__: {
              useBaseplateHosting: true,
              host: "https://cdn.walmart.com/",
            },
          },
        },
      },
    };

    (global.MAIN_KV as MockCloudflareKV).mockKv({
      "org-settings-walmart": orgSettings,
    });
    mockFetch.mockReturnValueOnce(
      new Response("console.log('hi');", {
        status: 200,
      })
    );

    response = await handleApps(
      new Request(
        "https://cdn.baseplate.cloud/walmart/apps/navbar/c1a777c770ee187cebedd0724653c771495f2af9/react-mf-navbar.js"
      ),
      {
        orgKey: "walmart",
        customerEnv: "__main__",
        pathParts: [
          "navbar",
          "c1a777c770ee187cebedd0724653c771495f2af9",
          "react-mf-navbar.js",
        ],
      }
    );

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect((mockFetch.mock.calls[0][0] as Request).url).toBe(
      "https://cdn.walmart.com/navbar/c1a777c770ee187cebedd0724653c771495f2af9/react-mf-navbar.js"
    );
  });

  it(`appends cors headers to cross origin requests`, async () => {
    mockFetch.mockReturnValueOnce(
      new Response("console.log('hi');", {
        status: 200,
      })
    );

    response = await handleApps(
      new Request(
        "https://cdn.baseplate.cloud/walmart/apps/navbar/c1a777c770ee187cebedd0724653c771495f2af9/react-mf-navbar.js",
        {
          headers: {
            // this makes it a cross-origin request
            Origin: "example.com",
          },
        }
      ),
      {
        orgKey: "walmart",
        customerEnv: "__main__",
        pathParts: [
          "navbar",
          "c1a777c770ee187cebedd0724653c771495f2af9",
          "react-mf-navbar.js",
        ],
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeTruthy();
  });

  it(`appends baseplate-version header to apps`, async () => {
    mockFetch.mockReturnValueOnce(
      new Response("console.log('hi');", {
        status: 200,
      })
    );

    response = await handleApps(
      new Request(
        "https://cdn.baseplate.cloud/walmart/apps/navbar/c1a777c770ee187cebedd0724653c771495f2af9/react-mf-navbar.js"
      ),
      {
        orgKey: "walmart",
        customerEnv: "__main__",
        pathParts: [
          "navbar",
          "c1a777c770ee187cebedd0724653c771495f2af9",
          "react-mf-navbar.js",
        ],
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("baseplate-version")).toBeTruthy();
  });

  it(`sets cache-control header for apps`, async () => {
    mockFetch.mockReturnValueOnce(
      new Response("console.log('hi');", {
        status: 200,
      })
    );

    response = await handleApps(
      new Request(
        "https://cdn.baseplate.cloud/walmart/apps/navbar/c1a777c770ee187cebedd0724653c771495f2af9/react-mf-navbar.js"
      ),
      {
        orgKey: "walmart",
        customerEnv: "__main__",
        pathParts: [
          "navbar",
          "c1a777c770ee187cebedd0724653c771495f2af9",
          "react-mf-navbar.js",
        ],
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable"
    );
  });

  it(`can retrieve a file from s3`, async () => {
    const orgSettings: RecursivePartial<OrgSettings> = {
      orgExists: true,
      staticFiles: {
        microfrontendProxy: {
          environments: {
            __main__: {
              useBaseplateHosting: false,
              host: "s3://example",
            },
          },
        },
      },
    };

    (global.MAIN_KV as MockCloudflareKV).mockKv({
      "org-settings-walmart": orgSettings,
    });

    sendMock.mockReturnValueOnce(
      Promise.resolve({
        Body: "var a = 1",
        ContentType: "application/javascript",
      })
    );

    response = await handleApps(
      new Request("https://cdn.baseplate.cloud/walmart/apps/example.js"),
      {
        orgKey: "walmart",
        customerEnv: "__main__",
        pathParts: ["example.js"],
      }
    );
    let responseBody = await response.text();

    expect(response.ok).toBe(true);
    expect(response.headers.get("content-type")).toEqual(
      "application/javascript"
    );
    expect(responseBody).toEqual("var a = 1");
    expect(sendMock).toHaveBeenCalled();
    expect(sendMock.mock.calls[0][0].Bucket).toEqual("example");
    expect(sendMock.mock.calls[0][0].Key).toEqual("example.js");
  });

  it(`receives the correct 404 response if a file is not found in s3`, async () => {
    const orgSettings: RecursivePartial<OrgSettings> = {
      orgExists: true,
      staticFiles: {
        microfrontendProxy: {
          environments: {
            __main__: {
              useBaseplateHosting: false,
              host: "s3://example",
            },
          },
        },
      },
    };

    (global.MAIN_KV as MockCloudflareKV).mockKv({
      "org-settings-walmart": orgSettings,
    });

    sendMock.mockImplementationOnce(() => {
      const err = Error();
      err.Code = "NoSuchKey";
      throw err;
    });

    response = await handleApps(
      new Request("https://cdn.baseplate.cloud/walmart/apps/example.js"),
      {
        orgKey: "walmart",
        customerEnv: "__main__",
        pathParts: ["example.js"],
      }
    );

    expect(response.status).toBe(404);
  });
});

// https://stackoverflow.com/questions/41980195/recursive-partialt-in-typescript
type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P];
};
