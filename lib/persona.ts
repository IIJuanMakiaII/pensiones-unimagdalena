/**
 * La persona detrás de Nido: quién firma «Quiénes somos».
 *
 * POR QUÉ ESTO VIVE EN UN MÓDULO Y NO DENTRO DE LA PÁGINA
 * ------------------------------------------------------
 * Los tres datos de aquí se publican además en otro sitio, y cada uno en un
 * formato distinto:
 *
 *   · el nombre, en el texto visible y en los datos estructurados `Person`;
 *   · el LinkedIn, como enlace visible y como `sameAs` del mismo `Person`;
 *   · el correo, como enlace `mailto:`.
 *
 * Si el nombre viviera solo en el JSX, el `Person` de los datos estructurados
 * podría seguir diciendo una cosa mientras la página dice otra, y ese es
 * exactamente el tipo de desincronización que los datos estructurados castigan:
 * Google lee los dos y no tiene por qué creerle al que no ve el usuario.
 *
 * NOTA HONESTA SOBRE EL CORREO
 * ---------------------------
 * `lib/formato.ts` documenta que el correo de contacto del sitio se lee de
 * `NEXT_PUBLIC_CORREO_CONTACTO` y **no** se escribe en el código, precisamente
 * para que sea un dato del negocio y no del programa. Este correo es otra cosa:
 * es la dirección personal que el fundador publica **como suya** en la página
 * donde se presenta, junto a su foto y su LinkedIn. Esos tres datos no son
 * configuración del sitio —son la identidad de una persona— y por eso viven
 * aquí, en un solo sitio, y no repartidos por el marcado.
 *
 * El apellido se toma del propio perfil de LinkedIn del fundador
 * (`juan-s-otero-c`) y de su dirección de correo. La foto es un archivo del
 * repositorio: se sirve desde el dominio, nunca desde un tercero, para que la
 * imagen de la sección no dependa de que un servicio externo siga en pie.
 */

export const FUNDADOR = {
  /** Nombre que se muestra en la página y en el `Person` de los datos estructurados. */
  nombre: "Juan Otero",
  /** Cómo se firma en primera persona dentro del texto. */
  nombreDePila: "Juan",
  /** Lo que estudia y dónde: el dato que sostiene «soy estudiante, como tú». */
  estudio: "Negocios Internacionales y Economía en la Universidad del Magdalena",
  /** Retrato vertical del fundador, servido desde el dominio. */
  foto: "/marca/juan.jpg",
  /** Perfil profesional público: enlace visible y `sameAs` del `Person`. */
  linkedin: "https://www.linkedin.com/in/juan-s-otero-c/",
  /** Dirección publicada a propósito para que cualquiera pueda escribirle. */
  correo: "oterojuan15@gmail.com",
} as const;
