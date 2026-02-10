# 5. Concrete improvement checklist + Final verdict

---

## Concrete next steps

1. **Ensure all collisions use angular distance**
2. **Add bullet sub-stepping or swept collision**
3. **Precompute asteroid angular radii by size**
4. **Use dot-product early rejection**
5. *(Later)* Swap-remove instead of splice
6. *(Later)* Fully separate collision system from renderer

---

## Final verdict

Your approach is:

- conceptually correct
- well-suited to an arcade spherical shooter
- deterministic and engine-like in a good way

The main improvements are not rewrites, but making spherical geometry explicit everywhere:

> Angular distance + swept/sub-stepped collision will give you correct, reliable hits.

Once that’s in place, you’ll be very close to Super Stardust’s feel.

---
