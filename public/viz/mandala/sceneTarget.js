import { RenderTarget } from "wtc-gl";

// Scene G-buffer:
//   textures[0]: rgb lit colour, a linear view depth (0 = sky)
//   textures[1]: xyz view-space normal
// wtc-gl's RenderTarget attaches a 16-bit depth texture, which z-fights on
// coplanar faces, so it's swapped for a 24-bit depth renderbuffer.
export function createSceneTarget(gl, width, height, previous) {
  if (previous) disposeSceneTarget(gl, previous);

  const target = new RenderTarget(gl, {
    width,
    height,
    colour: 2,
    type: gl.FLOAT,
    format: gl.RGBA,
    internalFormat: gl.RGBA32F,
    minFilter: gl.NEAREST,
    magFilter: gl.NEAREST,
  });

  if (target.depthTexture) {
    gl.deleteTexture(target.depthTexture.texture);
    target.depthTexture = null;
  }
  const depth = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
  gl.renderer.bindFramebuffer({ buffer: target.buffer });
  gl.framebufferRenderbuffer(
    gl.FRAMEBUFFER,
    gl.DEPTH_ATTACHMENT,
    gl.RENDERBUFFER,
    depth,
  );
  gl.renderer.bindFramebuffer();
  target.depthBuffer = depth;

  return target;
}

export function disposeSceneTarget(gl, target) {
  target.textures.forEach((t) => gl.deleteTexture(t.texture));
  gl.deleteRenderbuffer(target.depthBuffer);
  gl.deleteFramebuffer(target.buffer);
}
