# Preguntas concretas para el abogado

> **Uso de este documento.** Son las preguntas que **no podemos responder nosotros**
> porque dependen de decisiones legales o de negocio, no de cómo está construido el
> sitio. Cada una lleva el contexto necesario para responderse sin leer todo el
> proyecto.
>
> Lo que ya está resuelto y no requiere criterio jurídico está al final, en la
> sección «Ya definido», para que no se gaste tiempo ahí.

---

## A. Quién responde y con qué figura

**Contexto:** el sitio publica datos de contacto de terceros. Hoy no hay definida
ninguna figura legal: no existe razón social, NIT ni domicilio.

1. ¿Conviene que el responsable sea **persona natural**, o hay razón para
   constituir una figura societaria antes de abrir al público?
2. Si es persona natural, **¿su nombre y su número de documento quedan publicados**
   en el aviso de privacidad? ¿Hay alternativa que cumpla la ley sin exponer sus
   datos personales?
3. ¿Está obligado el proyecto a **inscribir sus bases de datos en el Registro
   Nacional de Bases de Datos**, o aplica alguna excepción por tamaño?
4. ¿Hay alguna obligación adicional por tratar datos de **estudiantes
   universitarios** como población?

## B. El número de WhatsApp del anfitrión (el punto más delicado)

**Contexto:** el número queda **legible públicamente, incluso por quien no tiene
cuenta**. No es un descuido: la ficha se sirve sin sesión, así que el número tiene
que poder leerse para construir el botón de contacto. Los anuncios que existen hoy
se publicaron **sin ninguna autorización**.

5. Un número de WhatsApp de una persona natural, **publicado de forma abierta a
   internet**, ¿exige alguna precaución adicional además de la autorización escrita?
   ¿Se considera dato público, semiprivado o privado?
6. **Los anuncios ya publicados sin autorización:** ¿cuál es la vía correcta?
   Nuestra propuesta es pedir la autorización de nuevo y no dar por válida ninguna
   anterior. ¿Basta con eso, o hay que retirarlos hasta obtenerla?
7. ¿Es suficiente **una casilla no premarcada más la fecha del registro** como prueba
   de la autorización, o se requiere un documento aparte firmado?
8. ¿Se puede aceptar la autorización desde el sitio, o la ley exige que quede
   constancia por un medio específico en el que el anfitrión pueda consultarla
   después?
9. Si un anfitrión pide que se le retire el número: **¿en cuánto tiempo hay que
   hacerlo efectivo?** ¿Y qué pasa con el número ya copiado por terceros?
10. ¿Es correcto **no** publicar ese número en los datos estructurados para
    buscadores —ni en los metadatos de la página— aunque sí se muestre en la ficha?
    Es la decisión que tomamos, y queremos confirmar que no nos perjudica.

## C. Lo que el sitio afirma públicamente

**Contexto:** el sitio dice hoy, literalmente:

- «Pensiones verificadas a minutos de Unimagdalena» (portada)
- «**Inspeccionamos cada pensión antes de publicarla**: fotos reales, condiciones
  confirmadas y anfitriones validados»
- «Hablas directo con el anfitrión por WhatsApp. **Sin comisiones ocultas** ni
  terceros en el camino»
- Un sello que dice «Verificada por el equipo»

11. Como **plataforma** y no como arrendador, ¿qué nivel de responsabilidad asumimos
    por lo que publica un anfitrión (un inmueble que no existe, un precio falso, una
    foto que no es del sitio)?
12. Esa frase de «inspeccionamos cada pensión»: **¿es la redacción adecuada para una
    plataforma, o nos convierte en garantes** de lo que allí se ofrece?
13. «Sin comisiones ocultas»: si más adelante cobramos al anfitrión, ¿la frase se
    puede sostener mientras se comunique de forma clara, o hay que cambiarla?
14. ¿Conviene una **cláusula de exención de responsabilidad** por el contenido
    publicado por usuarios? ¿Con qué límites puede ser declarada ineficaz?
15. ¿Necesitamos **condiciones distintas** para anfitriones que arriendan como
    actividad económica frente a quien arrienda una habitación de su propia casa?

## D. Uso del nombre de la universidad

**Contexto:** el sitio se llama «Pensiones Unimagdalena», usa «Unimagdalena» y
«Universidad del Magdalena» en la portada, y el proyecto nace en ese entorno
académico.

16. ¿Se puede **usar el nombre de la universidad** en el nombre del sitio y en los
    textos, sin autorización expresa? ¿Conviene pedir un permiso formal?
17. Si la universidad no autoriza, ¿qué **cambios mínimos** hacen falta para no
    infringir su nombre o su marca?

## E. El negocio y el arriendo

18. ¿La plataforma debe ofrecer un **modelo de contrato de arriendo** a las partes,
    o eso agrava nuestra posición como intermediarios?
19. Si se cobra comisión al anfitrión: ¿qué **obligaciones de facturación** e
    información al consumidor se activan?
20. ¿Aplica la **Ley 1480 (consumidor)** a esta relación, y qué debería decir el
    aviso para cumplirla — particularmente si el estudiante es menor de 18 años?

## F. Plazos, canales y conservación

21. **¿Cuánto tiempo** podemos conservar los datos de un anuncio retirado? Nuestra
    propuesta es conservarlo sin publicar temporalmente por si el anfitrión vuelve,
    y borrarlo después.
22. ¿Cuál es el **plazo legal de respuesta** a una solicitud de consulta, reclamo o
    supresión, y qué debe contener nuestra respuesta?
23. ¿Texto concreto para la **política de tratamiento** que debe ir en el sitio?

---

## Ya definido (no hace falta criterio jurídico)

Estas cosas ya están resueltas técnicamente y solo se mencionan para que se
conozcan; no requieren respuesta:

- Las **contraseñas están cifradas** y nadie del equipo puede leerlas.
- Los **correos y nombres de las cuentas no son públicos**: cada persona solo ve su
  propio perfil. Verificado en las políticas de acceso de la base de datos.
- Hay **medición sin cookies** que no identifica personas; por eso el sitio no
  necesita aviso de cookies.
- Un anfitrión **no puede modificar por su cuenta** el sello de verificación, la
  calificación ni el precio: son campos protegidos a nivel de base de datos.
- El número de WhatsApp **no se publica en datos estructurados ni en metadatos**.
- Existe una **página de recuperación de contraseña** funcional.

---

## Cómo usar este documento

Las respuestas a las secciones **A**, **B** y **C** son las que bloquean la
apertura al público. Las de **D** y **E** conviene tenerlas antes de facturar algo.
Las de **F** antes de publicar el aviso.

Los cuatro borradores legales del proyecto están en esta misma carpeta y deben
quedar alineados con lo que se responda aquí:

- [aviso-de-privacidad.md](aviso-de-privacidad.md)
- [condiciones-de-uso.md](condiciones-de-uso.md)
- [autorizacion-anfitrion.md](autorizacion-anfitrion.md)
