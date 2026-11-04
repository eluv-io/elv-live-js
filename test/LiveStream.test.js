const {EluvioLiveStream} = require("../src/LiveStream");

const Setup = () => {
  const stream = new EluvioLiveStream({});
  const result = {
    liveObjectId: "iq__live",
    liveHash: "hq__live",
    targetObjectId: "iq__vod",
    targetLibraryId: "ilibTarget",
    targetWriteToken: "tqw__copy",
    targetHash: "hq__vod"
  };
  stream.FindContentType = jest.fn().mockResolvedValue("hq__title");
  stream.client = {
    CreateContentObject: jest.fn().mockResolvedValue({objectId: "iq__vod", writeToken: "tqw__new"}),
    CreateEncryptionConk: jest.fn().mockResolvedValue(undefined),
    SetPermission: jest.fn().mockResolvedValue(undefined),
    FinalizeContentObject: jest.fn().mockResolvedValue({hash: "hq__created"}),
    StreamCopyToVod: jest.fn().mockResolvedValue(result)
  };
  return {stream, result};
};

describe("Local copy-to-VOD client wrapper", () => {
  test("delegates all options for an existing target and retains local result fields", async () => {
    const {stream, result} = Setup();
    const options = {
      stream: "iq__live", object: "iq__vod", writeToken: "tqw__existing", drm: false, includeTags: true,
      defaultDash: true, keepExistingStreams: true, eventId: "123",
      startTime: "2026-11-03T10:00:00Z", endTime: "2026-11-03T11:00:00Z",
      recordingPeriod: 2, streams: {video: {stream_index: 0}}
    };
    const status = await stream.StreamCopyToVod(options);
    const {stream: source, object, ...forwarded} = options;
    expect(stream.client.StreamCopyToVod).toHaveBeenCalledWith({
      name: source, targetObjectId: object, ...forwarded
    });
    expect(stream.client.CreateContentObject).not.toHaveBeenCalled();
    expect(stream.client.CreateEncryptionConk).not.toHaveBeenCalled();
    expect(stream.client.FinalizeContentObject).not.toHaveBeenCalled();
    expect(status).toEqual({
      ...result, live_object_id: "iq__live", live_hash: "hq__live",
      target_object_id: "iq__vod", target_library_id: "ilibTarget",
      target_write_token: "tqw__copy", target_hash: "hq__vod"
    });
  });

  test("keeps the local DRM default and defaults to the latest recording period", async () => {
    const {stream} = Setup();
    await stream.StreamCopyToVod({stream: "iq__live", object: "iq__vod"});
    expect(stream.client.StreamCopyToVod).toHaveBeenCalledWith(expect.objectContaining({
      drm: true, includeTags: false, defaultDash: false,
      keepExistingStreams: false, recordingPeriod: -1
    }));
  });

  test("passes the new target draft to the client without an intermediate commit", async () => {
    const {stream} = Setup();
    stream.FindContentType = EluvioLiveStream.prototype.FindContentType;
    stream.client.userProfileClient = {
      TenantContractId: jest.fn().mockResolvedValue("itenTenant")
    };
    stream.client.ContentObjectLibraryId = jest.fn().mockResolvedValue("ilibTenant");
    stream.client.ContentObjectMetadata = jest.fn().mockResolvedValue({title: "hq__title"});
    await stream.StreamCopyToVod({stream: "iq__live", library: "ilibTarget", name: "My VOD", title: "My Title"});
    expect(stream.client.userProfileClient.TenantContractId).toHaveBeenCalled();
    expect(stream.client.ContentObjectMetadata).toHaveBeenCalledWith({
      objectId: "iq__Tenant", libraryId: "ilibTenant", metadataSubtree: "/public/content_types"
    });
    expect(stream.client.CreateContentObject).toHaveBeenCalledWith({
      libraryId: "ilibTarget", options: {
        type: "hq__title", createKMSConk: true,
        meta: {public: {name: "My VOD", asset_metadata: {title: "My Title"}}}
      }
    });
    expect(stream.client.CreateEncryptionConk).not.toHaveBeenCalled();
    expect(stream.client.SetPermission).toHaveBeenCalledWith({
      objectId: "iq__vod", writeToken: "tqw__new", permission: "editable"
    });
    expect(stream.client.FinalizeContentObject).not.toHaveBeenCalled();
    const permissionOrder = stream.client.SetPermission.mock.invocationCallOrder[0];
    const creationOrder = stream.client.CreateContentObject.mock.invocationCallOrder[0];
    const copyOrder = stream.client.StreamCopyToVod.mock.invocationCallOrder[0];
    expect(creationOrder).toBeLessThan(permissionOrder);
    expect(permissionOrder).toBeLessThan(copyOrder);
    expect(stream.client.StreamCopyToVod).toHaveBeenCalledWith(expect.objectContaining({
      targetObjectId: "iq__vod", writeToken: "tqw__new"
    }));
  });

  test("generates default names and titles for new targets", async () => {
    const {stream} = Setup();
    await stream.StreamCopyToVod({stream: "iq__live", library: "ilibTarget"});
    const {public: metadata} = stream.client.CreateContentObject.mock.calls[0][0].options.meta;
    expect(metadata.name).toMatch(/^VOD - Live Stream iq__live - /);
    expect(metadata.asset_metadata.title).toMatch(/^Live Stream iq__live - /);
  });

  test("stops before copying if object creation fails", async () => {
    const {stream} = Setup();
    stream.client.CreateContentObject.mockRejectedValue(new Error("Object creation failed"));
    await expect(stream.StreamCopyToVod({stream: "iq__live", library: "ilibTarget"})).rejects.toThrow("Object creation failed");
    expect(stream.client.SetPermission).not.toHaveBeenCalled();
    expect(stream.client.StreamCopyToVod).not.toHaveBeenCalled();
  });

  test("rejects missing target information or content type before creating an object", async () => {
    const {stream} = Setup();
    await expect(stream.StreamCopyToVod({stream: "iq__live"})).rejects.toThrow("one of object or library must be specified");
    stream.FindContentType.mockResolvedValue(undefined);
    await expect(stream.StreamCopyToVod({stream: "iq__live", library: "ilibTarget"})).rejects.toThrow("content type not found: title");
    expect(stream.client.CreateContentObject).not.toHaveBeenCalled();
  });

  test("propagates copy errors and does not delegate when setting permissions fails", async () => {
    const {stream} = Setup();
    stream.client.StreamCopyToVod.mockRejectedValue(new Error("Copy failed"));
    await expect(stream.StreamCopyToVod({stream: "iq__live", object: "iq__vod"})).rejects.toThrow("Copy failed");
    stream.client.StreamCopyToVod.mockClear();
    stream.client.SetPermission.mockRejectedValue(new Error("Permission failed"));
    await expect(stream.StreamCopyToVod({stream: "iq__live", library: "ilibTarget"})).rejects.toThrow("Permission failed");
    expect(stream.client.StreamCopyToVod).not.toHaveBeenCalled();
  });
});
