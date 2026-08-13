const { EluvioLiveStream } = require("../src/LiveStream");

test("retrieves live output configuration and runtime state", async () => {
  const result = {
    input: {stream: "iq__input"},
    srt_push: {node_id: "inod123"},
    state: {
      client_stats: {bytes_sent: 1234},
      details: {status: "running"}
    }
  };
  const OutputsState = jest.fn().mockResolvedValue(result);
  const liveStream = Object.create(EluvioLiveStream.prototype);
  liveStream.client = {OutputsState};

  await expect(liveStream.OutputStatus({
    name: "iq__stream",
    outputId: "out001"
  })).resolves.toEqual(result);

  expect(OutputsState).toHaveBeenCalledWith({
    objectId: "iq__stream",
    outputId: "out001",
    includeState: true
  });
});

test("retrieves the current tenant object information and metadata", async () => {
  const TenantContractId = jest.fn().mockResolvedValue("itenTenant");
  const ContentObjectLibraryId = jest.fn(({objectId}) => Promise.resolve(`ilib-${objectId}`));
  const metadata = {
    public: {
      sites: {live_streams: "iq__liveStreams"}
    }
  };
  const ContentObjectMetadata = jest.fn().mockResolvedValue(metadata);
  const liveStream = Object.create(EluvioLiveStream.prototype);
  liveStream.client = {
    userProfileClient: {TenantContractId},
    ContentObjectLibraryId,
    ContentObjectMetadata
  };

  await expect(liveStream.TenantInfo()).resolves.toEqual({
    tenantId: "itenTenant",
    tenantObjectId: "iq__Tenant",
    tenantLibraryId: "ilib-iq__Tenant",
    metadata
  });

  expect(ContentObjectMetadata).toHaveBeenCalledWith({
    libraryId: "ilib-iq__Tenant",
    objectId: "iq__Tenant"
  });
});

test("lists output IDs from the tenant's live streams site", async () => {
  const TenantInfo = jest.fn().mockResolvedValue({
    tenantObjectId: "iq__Tenant",
    metadata: {
      public: {
        sites: {live_streams: "iq__liveStreams"}
      }
    }
  });
  const ContentObjectLibraryId = jest.fn(({objectId}) => Promise.resolve(`ilib-${objectId}`));
  const ContentObjectMetadata = jest.fn(({objectId, metadataSubtree}) => {
    expect(metadataSubtree).toBe("/live_outputs");

    if (objectId === "iq__liveStreams") {
      return Promise.resolve(["iq__outputs1", "iq__outputs2"]);
    }

    if (objectId === "iq__outputs1") {
      return Promise.resolve({
        out001: {
          name: "Primary Pull Output",
          enabled: true,
          srt_pull: {urls: ["srt://pull-a.example", "srt://pull-b.example"]}
        },
        out002: {
          name: "Backup Push Output",
          enabled: false,
          srt_push: {url: "srt://push.example"}
        }
      });
    }

    return Promise.resolve({
      out003: {
        name: "RTP Output",
        enabled: true,
        rtp: {url: "rtp://239.0.0.1:5004"}
      },
      out004: {
        name: "UDP Output",
        enabled: true,
        udp: {url: "udp://239.0.0.1:1234"}
      }
    });
  });
  const liveStream = Object.create(EluvioLiveStream.prototype);
  liveStream.TenantInfo = TenantInfo;
  liveStream.client = {
    ContentObjectLibraryId,
    ContentObjectMetadata
  };

  await expect(liveStream.OutputList()).resolves.toEqual([
    {
      objectId: "iq__outputs1",
      outputId: "out001",
      name: "Primary Pull Output",
      type: "srt_pull",
      url: "srt://pull-a.example"
    },
    {
      objectId: "iq__outputs1",
      outputId: "out001",
      name: "Primary Pull Output",
      type: "srt_pull",
      url: "srt://pull-b.example"
    },
    {
      objectId: "iq__outputs1",
      outputId: "out002",
      name: "Backup Push Output",
      type: "srt_push",
      url: "srt://push.example"
    },
    {
      objectId: "iq__outputs2",
      outputId: "out003",
      name: "RTP Output",
      type: "rtp",
      url: "rtp://239.0.0.1:5004"
    },
    {
      objectId: "iq__outputs2",
      outputId: "out004",
      name: "UDP Output",
      type: "udp",
      url: "udp://239.0.0.1:1234"
    }
  ]);

  expect(TenantInfo).toHaveBeenCalledTimes(1);
  expect(ContentObjectLibraryId).toHaveBeenCalledTimes(3);
  expect(ContentObjectMetadata).toHaveBeenCalledTimes(3);
});

test("lists stream QIDs, names and URLs without checking status", async () => {
  const TenantInfo = jest.fn().mockResolvedValue({
    tenantObjectId: "iq__Tenant",
    metadata: {
      public: {
        sites: {live_streams: "iq__liveStreams"}
      }
    }
  });
  const ContentObjectLibraryId = jest.fn().mockResolvedValue("ilibLiveStreams");
  const ContentObjectMetadata = jest.fn().mockResolvedValue({
    first: {".": {source: "hq__first"}},
    second: {"/": "/qfab/hq__second/meta/public/asset_metadata"},
    duplicate: {".": {source: "hq__first"}},
    broken: {}
  });
  const DecodeVersionHash = jest.fn(versionHash => ({
    objectId: versionHash === "hq__first" ? "iq__first" : "iq__second"
  }));
  const LimitedMap = jest.fn((limit, streams, callback) => {
    expect(limit).toBe(100);
    return Promise.all(streams.map(callback));
  });
  const StreamStatus = jest.fn();
  const liveStream = Object.create(EluvioLiveStream.prototype);
  liveStream.TenantInfo = TenantInfo;
  liveStream.StreamInfo = jest.fn(({objectId}) => Promise.resolve({
    objectId,
    name: `${objectId}-name`,
    url: `${objectId}-url`
  }));
  liveStream.client = {
    ContentObjectLibraryId,
    ContentObjectMetadata,
    StreamStatus,
    utils: {
      DecodeVersionHash,
      LimitedMap
    }
  };

  await expect(liveStream.StreamList()).resolves.toEqual([
    {objectId: "iq__first", name: "iq__first-name", url: "iq__first-url"},
    {objectId: "iq__second", name: "iq__second-name", url: "iq__second-url"}
  ]);

  expect(TenantInfo).toHaveBeenCalledTimes(1);
  expect(ContentObjectMetadata).toHaveBeenCalledWith({
    libraryId: "ilibLiveStreams",
    objectId: "iq__liveStreams",
    metadataSubtree: "public/asset_metadata/live_streams",
    resolveLinks: false,
    resolveIgnoreErrors: true,
    resolveIncludeSource: false
  });
  expect(StreamStatus).not.toHaveBeenCalled();
  expect(DecodeVersionHash).toHaveBeenCalledWith("hq__first");
  expect(DecodeVersionHash).toHaveBeenCalledWith("hq__second");
  expect(LimitedMap).toHaveBeenCalledTimes(1);
});

test("retrieves stream name and URL from finalized metadata", async () => {
  const ContentObjectMetadata = jest.fn().mockResolvedValue({
    live_recording_config: {
      name: "Example Stream",
      reference_url: "srt://example.test:1234"
    },
    public: {
      asset_metadata: {display_title: "Fallback Title"}
    }
  });
  const ContentObjectLibraryId = jest.fn().mockResolvedValue("ilibStream");
  const liveStream = Object.create(EluvioLiveStream.prototype);
  liveStream.client = {
    ContentObjectLibraryId,
    ContentObjectMetadata
  };

  await expect(liveStream.StreamInfo({objectId: "iq__stream"})).resolves.toEqual({
    objectId: "iq__stream",
    name: "Example Stream",
    url: "srt://example.test:1234"
  });
  expect(ContentObjectMetadata).toHaveBeenCalledWith({
    libraryId: "ilibStream",
    objectId: "iq__stream",
    select: [
      "live_recording_config/name",
      "live_recording_config/reference_url",
      "live_recording_config/url",
      "public/name",
      "public/asset_metadata/display_title",
      "public/asset_metadata/title"
    ]
  });
  expect(ContentObjectLibraryId).toHaveBeenCalledWith({objectId: "iq__stream"});
});

test("lists stream states independently when status is requested", async () => {
  const LimitedMap = jest.fn(async (limit, streams, callback) => {
    expect(limit).toBe(100);
    return Promise.all(streams.map(callback));
  });
  const liveStream = Object.create(EluvioLiveStream.prototype);
  liveStream.TenantInfo = jest.fn().mockResolvedValue({
    tenantObjectId: "iq__Tenant",
    metadata: {public: {sites: {live_streams: "iq__liveStreams"}}}
  });
  liveStream.StreamState = jest.fn(({objectId}) => {
    if (objectId === "iq__expired") {
      throw new Error("Write token not found");
    }

    return Promise.resolve("running");
  });
  liveStream.StreamInfo = jest.fn(({objectId}) => Promise.resolve({
    objectId,
    name: `${objectId}-name`,
    url: `${objectId}-url`
  }));
  liveStream.client = {
    ContentObjectLibraryId: jest.fn().mockResolvedValue("ilibLiveStreams"),
    ContentObjectMetadata: jest.fn().mockResolvedValue({
      running: {".": {source: "hq__running"}},
      expired: {".": {source: "hq__expired"}}
    }),
    utils: {
      DecodeVersionHash: versionHash => ({
        objectId: versionHash === "hq__running" ? "iq__running" : "iq__expired"
      }),
      LimitedMap
    }
  };

  await expect(liveStream.StreamList({includeStatus: true})).resolves.toEqual([
    {
      objectId: "iq__running",
      name: "iq__running-name",
      url: "iq__running-url",
      state: "running"
    },
    {
      objectId: "iq__expired",
      name: "iq__expired-name",
      url: "iq__expired-url",
      state: "unavailable"
    }
  ]);
});

test("reports an expired edge write token without calling stream status", async () => {
  const ContentObjectMetadata = jest.fn().mockResolvedValue({
    live_recording_config: {url: "srt://example.test"},
    live_recording: {
      fabric_config: {
        edge_write_token: "tqw__expired",
        ingress_node_api: "https://fabric.example.test"
      },
      playout_config: {},
      recording_config: {}
    }
  });
  const CallBitcodeMethod = jest.fn().mockRejectedValue(new Error("Conflict"));
  const RecordWriteToken = jest.fn();
  const StreamStatus = jest.fn();
  const liveStream = Object.create(EluvioLiveStream.prototype);
  liveStream.client = {
    ContentObjectLibraryId: jest.fn().mockResolvedValue("ilibStream"),
    ContentObjectMetadata,
    CallBitcodeMethod,
    RecordWriteToken,
    StreamStatus
  };

  await expect(liveStream.StreamState({objectId: "iq__stream"})).resolves.toBe("expired");
  expect(CallBitcodeMethod).toHaveBeenCalledWith({
    libraryId: "ilibStream",
    objectId: "iq__stream",
    method: "/live/meta",
    constant: true
  });
  expect(RecordWriteToken).toHaveBeenCalledWith({
    writeToken: "tqw__expired",
    fabricNodeUrl: "https://fabric.example.test"
  });
  expect(StreamStatus).not.toHaveBeenCalled();
});

test("reports unavailable for a redirect loop while reading edge metadata", async () => {
  const liveStream = Object.create(EluvioLiveStream.prototype);
  liveStream.client = {
    ContentObjectLibraryId: jest.fn().mockResolvedValue("ilibStream"),
    ContentObjectMetadata: jest.fn().mockResolvedValue({
      live_recording_config: {url: "srt://example.test"},
      live_recording: {
        fabric_config: {
          edge_write_token: "tqw__redirect",
          ingress_node_api: "fabric.example.test"
        },
        playout_config: {},
        recording_config: {}
      }
    }),
    CallBitcodeMethod: jest.fn().mockRejectedValue(new Error("ERR_TOO_MANY_REDIRECTS")),
    RecordWriteToken: jest.fn(),
    StreamStatus: jest.fn()
  };

  await expect(liveStream.StreamState({objectId: "iq__stream"})).resolves.toBe("unavailable");
  expect(liveStream.client.StreamStatus).not.toHaveBeenCalled();
});

test("reports inactive when a stream has no edge write token", async () => {
  const StreamStatus = jest.fn();
  const liveStream = Object.create(EluvioLiveStream.prototype);
  liveStream.client = {
    ContentObjectLibraryId: jest.fn().mockResolvedValue("ilibStream"),
    ContentObjectMetadata: jest.fn().mockResolvedValue({
      live_recording_config: {url: "srt://example.test"},
      live_recording: {
        fabric_config: {ingress_node_api: "fabric.example.test"},
        playout_config: {},
        recording_config: {}
      }
    }),
    CallBitcodeMethod: jest.fn(),
    RecordWriteToken: jest.fn(),
    StreamStatus
  };

  await expect(liveStream.StreamState({objectId: "iq__stream"})).resolves.toBe("inactive");
  expect(StreamStatus).not.toHaveBeenCalled();
});

test("reports stopped from edge metadata without a second SDK status call", async () => {
  const StreamStatus = jest.fn();
  const liveStream = Object.create(EluvioLiveStream.prototype);
  liveStream.client = {
    ContentObjectLibraryId: jest.fn().mockResolvedValue("ilibStream"),
    ContentObjectMetadata: jest.fn().mockResolvedValue({
      live_recording_config: {url: "srt://example.test"},
      live_recording: {
        fabric_config: {
          edge_write_token: "tqw__stopped",
          ingress_node_api: "fabric.example.test"
        },
        playout_config: {},
        recording_config: {}
      }
    }),
    CallBitcodeMethod: jest.fn().mockResolvedValue({
      live_recording: {recordings: {}}
    }),
    RecordWriteToken: jest.fn(),
    StreamStatus
  };

  await expect(liveStream.StreamState({objectId: "iq__stream"})).resolves.toBe("stopped");
  expect(StreamStatus).not.toHaveBeenCalled();
});
