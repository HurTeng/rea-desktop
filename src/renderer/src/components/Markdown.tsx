import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'

export function Markdown({
  content,
  onEvidence
}: {
  content: string
  onEvidence: (id: string) => void
}): React.JSX.Element {
  return (
    <div className="markdown">
      <ReactMarkdown
        urlTransform={(url) =>
          /^rea:\/\/evidence\/(?:ev|obs)_[a-f0-9]{64}$/.test(url) ? url : defaultUrlTransform(url)
        }
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(event) => {
                event.preventDefault()
                if (href?.startsWith('rea://evidence/'))
                  onEvidence(href.slice('rea://evidence/'.length))
                else if (href && /^https?:\/\//.test(href)) void window.rea.openExternal(href)
              }}
            >
              {children}
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
